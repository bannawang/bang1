/* Manager QR check-in: uses the SAME race_athlete_checkins and ACTIVE LIVE fixture
 * as the normal check-in menu. QR scanning is only a lookup, never a check-in.
 */
(function(){
  'use strict';
  const el=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,
    c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let snapshot=null,activeKey='',scannedRegId=0,loading=false,busy=false;
  let stream=null,frameId=0,scanGeneration=0,lastDecodeAt=0;
  let optionsHash='',lastTeamHash='';
  let fixtureItems=[],pickerOpen=false,pickerQuery='',pickerRound='all';
  const permitted=()=>{
    const user=typeof currentUser==='undefined'?null:currentUser;
    return !!user&&(user.role==='Admin'||user.role==='TopAdmin'||
      (user.role==='Manager'&&user.canLiveCheckin===true));
  };
  const onPage=()=>el('page-qr-checkin')?.classList.contains('active')===true;
  const request=(action,payload)=>{
    if(!window.bang1Bridge?.adminRequest)
      return Promise.reject(Error('ไม่พบการเชื่อมต่อระบบ'));
    return window.bang1Bridge.adminRequest(action,payload);
  };
  const notice=(value,kind='info')=>{
    const n=el('bang1QrStatus');if(!n)return;
    const text=String(value??'').trim();
    n.textContent=text;
    n.dataset.kind=text?kind:'idle';
    n.hidden=!text;
  };
  function stopCamera(){
    scanGeneration++;
    if(frameId)cancelAnimationFrame(frameId);
    frameId=0;
    if(stream){stream.getTracks().forEach(track=>track.stop());stream=null;}
    const video=el('bang1QrVideo');
    if(video){video.pause();video.srcObject=null;}
    const panel=el('bang1QrCamera');if(panel)panel.hidden=true;
    const stop=el('bang1QrStop');if(stop){stop.disabled=true;stop.hidden=true;}
    const start=el('bang1QrStart');if(start)start.disabled=!activeKey;
  }
  function resetCard(){
    scannedRegId=0;lastTeamHash='';
    const card=el('bang1QrResultCard');
    if(card)card.hidden=true;
    const result=el('bang1QrResult');
    if(result)result.replaceChildren();
  }
  function fixtureLabel(f){
    const number=String(f?.eventNumberLabel||f?.eventId||'');
    const heats=Array.isArray(f?.heats)&&f.heats.length>1?
      ' · ฮีท '+f.heats.join('–'):'';
    return 'รายการที่ '+number+' · '+String(f?.eventName||'')+
      ' · '+String(f?.round||'')+heats;
  }

  // Match the official program order and picker appearance in "เช็กชื่อรายงานตัว".
  const isFinalFixture=f=>/^(รอบชิง|ชิงชนะเลิศ)/.test(String(f?.round||''));
  const isReadyFinal=f=>f?.qualifiedFinal===true&&isFinalFixture(f);
  const isPendingFinal=f=>f?.pendingFinal===true&&isFinalFixture(f);
  function pickerOrder(f){
    const order=Number(f?.order);
    if(Number.isFinite(order)&&order>0)return order;
    const id=Number(f?.eventId);
    if(Number.isFinite(id)&&id>0)return id;
    const m=String(f?.eventNumberLabel||'').match(/^\d+/);
    return m?Number(m[0]):Number.MAX_SAFE_INTEGER;
  }
  function sortedFixtures(items){
    return [...items].sort((a,b)=>pickerOrder(a)-pickerOrder(b)||
      Number(a?.eventId||0)-Number(b?.eventId||0)||
      Number(a?.heat||0)-Number(b?.heat||0));
  }
  function fixtureTitle(f){
    return 'รายการที่ '+String(f?.eventNumberLabel||f?.eventId||'—')+
      ' · '+String(f?.eventName||'ไม่ระบุรายการ');
  }
  function fixtureDetails(f){
    const heat=Array.isArray(f?.heats)&&f.heats.length>1
      ?'ฮีท '+f.heats.join('–'):(f?.heat?'ฮีท '+f.heat:'');
    return [f?.category,f?.level,f?.gender,heat].filter(Boolean).join(' · ');
  }
  function updatePickerTrigger(){
    const trigger=el('bang1QrFixtureTrigger');
    if(!trigger)return;
    const selected=fixtureItems.find(f=>f.key===activeKey)||snapshot?.active||null;
    el('bang1QrFixtureCurrentTitle').textContent=selected?
      fixtureTitle(selected):'เลือกรายการแข่งขัน';
    el('bang1QrFixtureCurrentDetail').textContent=selected?
      [fixtureDetails(selected),selected.round].filter(Boolean).join(' · '):
      'ค้นหาและเลือกการแข่งขันก่อนสแกน QR';
    trigger.classList.toggle('is-final',Boolean(selected&&isFinalFixture(selected)));
    trigger.classList.toggle('has-selection',Boolean(selected));
  }
  function positionPicker(){
    if(!pickerOpen)return;
    const trigger=el('bang1QrFixtureTrigger'),menu=el('bang1QrFixturePopover');
    if(!trigger||!menu)return;
    const rect=trigger.getBoundingClientRect(),vw=window.innerWidth,vh=window.innerHeight;
    const width=Math.min(1000,Math.max(0,vw-16),Math.max(rect.width,260));
    const left=Math.min(Math.max(8,rect.left),Math.max(8,vw-width-8));
    const height=Math.min(620,Math.max(240,Math.round(vh*.74)),vh-16);
    const below=Math.max(0,vh-rect.bottom-12),above=Math.max(0,rect.top-12);
    let top,available;
    if(below>=Math.min(320,height)||below>=above){
      top=rect.bottom+8;available=vh-top-8;
    }else{
      available=above;top=Math.max(8,rect.top-Math.min(height,available)-8);
    }
    if(available<225){top=8;available=vh-16;}
    menu.style.left=left+'px';
    menu.style.top=top+'px';
    menu.style.width=width+'px';
    menu.style.maxHeight=Math.max(120,Math.min(height,available))+'px';
  }
  function renderPicker(){
    const list=el('bang1QrFixtureList'),footer=el('bang1QrFixtureResults');
    if(!list||!footer)return;
    const previousScroll=list.scrollTop;
    const focusedKey=list.contains(document.activeElement)?
      document.activeElement.closest('[data-key]')?.dataset.key:null;
    const query=pickerQuery.toLocaleLowerCase('th').replace(/\s+/g,'');
    const visible=sortedFixtures(fixtureItems.filter(f=>{
      if(pickerRound==='final'&&!isFinalFixture(f))return false;
      if(pickerRound==='prelim'&&isFinalFixture(f))return false;
      const haystack=[fixtureTitle(f),fixtureDetails(f),f.round||''].join(' ')
        .toLocaleLowerCase('th').replace(/\s+/g,'');
      return !query||haystack.includes(query);
    }));
    list.replaceChildren();
    if(!visible.length){
      const empty=document.createElement('p');
      empty.className='bang1-fixture-no-results';
      empty.textContent='ไม่พบรายการแข่งขันที่ตรงกับคำค้นหา';
      list.appendChild(empty);
    }
    for(const f of visible){
      const option=document.createElement('button');
      option.type='button';
      option.className='bang1-fixture-option'+
        (isFinalFixture(f)?' is-final':'')+
        (isReadyFinal(f)?' is-qualified-final':'')+
        (isPendingFinal(f)?' is-pending-final':'')+
        (activeKey===f.key?' is-selected':'');
      option.disabled=isPendingFinal(f)||busy;
      option.setAttribute('role','option');
      option.setAttribute('aria-disabled',option.disabled?'true':'false');
      option.setAttribute('aria-selected',activeKey===f.key?'true':'false');
      option.dataset.key=f.key;
      option.innerHTML=
        '<span class="bang1-fixture-number">'+esc(f.eventNumberLabel||f.eventId||'—')+'</span>'+
        '<span class="bang1-fixture-option-copy">'+
          '<strong>'+esc(f.eventName||'ไม่ระบุรายการ')+'</strong>'+
          '<small>'+esc(fixtureDetails(f))+'</small>'+
        '</span>'+
        '<span class="bang1-fixture-option-meta">'+
          '<span class="bang1-fixture-round">'+
            (isReadyFinal(f)?'✅ ผ่านคัดเลือก · รอบชิง':
              isPendingFinal(f)?'⏳ รอบชิง · รอผลคัดเลือก':
              isFinalFixture(f)?'🏆 รอบชิง':esc(f.round||'รอยืนยันรอบ'))+'</span>'+
          '<small>'+(isReadyFinal(f)?
             Number(f.teams||0)+' โรงเรียน · พร้อมปล่อย LIVE':
             isPendingFinal(f)?
               Number(f.qualificationSavedHeats||0)+'/'+Number(f.qualificationRequiredHeats||2)+
               ' ฮีท · ยังไม่เปิดให้ปล่อย LIVE':
             Number(f.checked||0)+'/'+Number(f.total||0)+' คน')+'</small>'+
        '</span>';
      option.addEventListener('click',()=>{
        if(isPendingFinal(f)||busy)return;
        closePicker(true);
        if(f.key===activeKey)return;
        el('bang1QrFixture').value=f.key;
        void selectFixture();
      });
      list.appendChild(option);
    }
    if(focusedKey){
      const node=[...list.querySelectorAll('[data-key]')].find(b=>b.dataset.key===focusedKey);
      node?.focus({preventScroll:true});
    }
    list.scrollTop=previousScroll;
    const ready=fixtureItems.filter(isReadyFinal).length;
    const pending=fixtureItems.filter(isPendingFinal).length;
    footer.textContent='แสดง '+visible.length+' จาก '+fixtureItems.length+
      ' รายการแข่งขัน · เรียงตามลำดับรายการจัดแข่งขัน · พร้อมรอบชิง '+ready+
      ' · รอผลคัดเลือก '+pending+' · อัปเดตอัตโนมัติ';
    el('bang1QrFixturePopover').querySelectorAll('[data-round]').forEach(btn=>{
      const active=btn.dataset.round===pickerRound;
      btn.classList.toggle('is-active',active);
      btn.setAttribute('aria-pressed',active?'true':'false');
    });
  }
  function openPicker(){
    if(!onPage()||!permitted()||busy)return;
    const menu=el('bang1QrFixturePopover'),trigger=el('bang1QrFixtureTrigger');
    if(menu.parentElement!==document.body)document.body.appendChild(menu);
    pickerOpen=true;pickerQuery='';pickerRound='all';
    el('bang1QrFixtureSearch').value='';
    menu.hidden=false;trigger.setAttribute('aria-expanded','true');
    renderPicker();positionPicker();
    void refresh();
    const selected=menu.querySelector('.bang1-fixture-option.is-selected');
    selected?.scrollIntoView({block:'nearest'});
    if(window.matchMedia('(pointer: fine)').matches)
      el('bang1QrFixtureSearch').focus({preventScroll:true});
  }
  function closePicker(restoreFocus=false){
    if(!pickerOpen)return;
    pickerOpen=false;
    const menu=el('bang1QrFixturePopover'),trigger=el('bang1QrFixtureTrigger');
    menu.hidden=true;trigger.setAttribute('aria-expanded','false');
    if(restoreFocus&&onPage())trigger.focus({preventScroll:true});
  }
  function pickerKeydown(event){
    if(!pickerOpen)return;
    if(event.key==='Escape'){event.preventDefault();closePicker(true);return;}
    if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
    const buttons=[...el('bang1QrFixtureList').querySelectorAll('button[role="option"]:not(:disabled)')];
    if(!buttons.length)return;
    event.preventDefault();
    const current=buttons.indexOf(document.activeElement);
    const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:
      event.key==='ArrowDown'?(current<0?0:(current+1)%buttons.length):
      (current<0?buttons.length-1:(current-1+buttons.length)%buttons.length);
    buttons[next].focus({preventScroll:true});
    buttons[next].scrollIntoView({block:'nearest'});
  }
  function updateOptions(data){
    const opts=[...(data?.fixtures||[]),...(data?.pendingFinals||[])];
    const signature=JSON.stringify(opts.map(f=>
      [f.key,f.eventNumberLabel,f.eventName,f.round,f.order,f.pendingFinal,
       f.qualifiedFinal,f.checked,f.total,f.teams,f.qualificationSavedHeats,f.qualificationRequiredHeats]));
    const select=el('bang1QrFixture');if(!select)return;
    if(signature!==optionsHash){
      optionsHash=signature;
      fixtureItems=sortedFixtures(opts);
      select.replaceChildren(new Option('— เลือกรายการแข่งขัน —',''));
      for(const f of fixtureItems){
        const option=new Option(fixtureLabel(f)+(f.pendingFinal?' · รอผลคัดเลือก':''),f.key);
        option.disabled=isPendingFinal(f);
        select.add(option);
      }
      if(pickerOpen)renderPicker();
    }
    select.value=activeKey||'';
    updatePickerTrigger();
    el('bang1QrStart').disabled=!activeKey;
    const active=data?.active;
    el('bang1QrActive').textContent=active?
      '📺 จอ LIVE: '+fixtureLabel(active)+(active.qualifiedFinal?
        ' · รอบชิงแสดงรายชื่อเท่านั้น':''):
      'ยังไม่ได้เปิดรายการ LIVE · เลือกรายการแข่งขันก่อนสแกน';
  }
  function renderTeam(team){
    const panel=el('bang1QrResult'),card=el('bang1QrResultCard');
    if(!panel||!card)return;
    const hash=JSON.stringify(team);
    if(hash===lastTeamHash&&!card.hidden)return;
    lastTeamHash=hash;
    const final=team?.qualifiedFinal===true;
    const count=Number(team?.checkedAthletes||0);
    const cap=Number(team?.totalAthletes||1);
    const full=count>=cap;
    el('bang1QrCount').textContent=final?'รอบชิง · ดูอย่างเดียว':
      count+'/'+cap+' คน';
    let markup='<div class="bang1-qr-school"><strong>'+esc(team.school)+
      '</strong><small>#'+Number(team.regId)+
      (team.heat?' · ฮีท '+Number(team.heat):'')+
      (team.lane?' · ลู่ '+Number(team.lane):'')+'</small></div>';
    if(!Array.isArray(team.athletes)||team.athletes.length===0)
      markup+='<p class="bang1-qr-empty">ยังไม่มีนักกรีฑา</p>';
    for(const athlete of team.athletes||[]){
      const checked=athlete.checkedAt!=null;
      const disabled=full&&!checked;
      const photo=athlete.photo?
        '<img src="'+esc(athlete.photo)+'" alt="" loading="lazy" referrerpolicy="no-referrer">':
        '<span class="bang1-qr-fallback">🏃</span>';
      const control=final?
        '<span class="bang1-qr-readonly" aria-label="รอบชิงเปลี่ยนตัวไม่ได้">🔒</span>':
        '<input type="checkbox" data-athlete="'+esc(athlete.athleteKey)+'"'+
        (checked?' checked':'')+(disabled?' disabled':'')+
        ' aria-label="เช็กชื่อ '+esc(athlete.name)+'">';
      markup+='<label class="bang1-qr-runner'+(checked?' is-checked':'')+'">'+
        control+photo+'<span><strong>'+esc(athlete.name)+'</strong><small>'+
        (final?'🔒 รอบชิง · ดูอย่างเดียว':
        checked?'✓ เช็กชื่อแล้ว':
        disabled?'เต็มจำนวน':'แตะเพื่อเช็กชื่อ')+
        '</small></span></label>';
    }
    panel.innerHTML=markup;
    card.hidden=false;
  }
  function applyState(state){
    const oldKey=activeKey;
    snapshot=state;
    activeKey=String(state?.active?.key||'');
    if(oldKey!==activeKey){
      stopCamera();
      resetCard();
    }
    updateOptions(state);
    if(pickerOpen&&oldKey!==activeKey)renderPicker();
    if(scannedRegId){
      const team=(state?.teams||[]).find(x=>Number(x.regId)===scannedRegId);
      if(team)renderTeam(team);
      else {
        resetCard();
        notice('รายการ LIVE หรือใบสมัครเปลี่ยนไปแล้ว กรุณาสแกน QR อีกครั้ง','error');
      }
    }
  }
  async function refresh(quiet=true){
    if(!permitted()||!onPage()||loading||busy)return;
    loading=true;
    try{
      const state=await request('live_manager_data');
      if(onPage())applyState(state);
      if(!quiet)notice('อัปเดตข้อมูลรายการ LIVE และการรายงานตัวแล้ว','success');
    }catch(err){notice(err.message||'ไม่สามารถโหลดข้อมูลรายการได้','error');}
    finally{loading=false;}
  }
  async function selectFixture(){
    if(busy||!permitted())return;
    stopCamera();resetCard();
    const key=el('bang1QrFixture').value;
    busy=true;
    notice('กำลังเลือกรายการแข่งขันที่แสดงบนจอ LIVE...');
    try{
      await request('live_select',{fixtureKey:key});
      const state=await request('live_manager_data');
      applyState(state);
      notice(key?'เลือกรายการแข่งขันแล้ว · สามารถสแกน QR ได้':'ปิดรายการ LIVE แล้ว',
        'success');
    }catch(err){
      notice(err.message||'ไม่สามารถเปลี่ยนรายการ LIVE','error');
      try{applyState(await request('live_manager_data'));}catch(_){}
    }finally{busy=false;}
  }
  async function lookup(raw){
    if(busy||!permitted())return;
    if(!activeKey){notice('กรุณาเลือกรายการแข่งขันก่อนสแกน','error');return;}
    stopCamera();resetCard();
    busy=true;notice('กำลังตรวจสอบ QR กับใบสมัครของรายการ LIVE...');
    try{
      const result=await request('live_qr_lookup',{qr:String(raw||''),fixtureKey:activeKey});
      const state=await request('live_manager_data');
      if(state.active?.key!==result.fixtureKey){
        applyState(state);
        throw Error('รายการ LIVE เปลี่ยนระหว่างสแกน กรุณาเลือกและสแกนอีกครั้ง');
      }
      scannedRegId=Number(result.registrationId);
      applyState(state);
      notice('✓ '+result.school,'success');
      el('bang1QrManual').value='';
      el('bang1QrManual').blur();
      if(onPage()){
        el('bang1QrResultCard')?.scrollIntoView({
          behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',
          block:'nearest'
        });
      }
    }catch(err){
      notice(err.message||'ไม่สามารถอ่าน QR ของใบสมัครนี้','error');
    }finally{busy=false;}
  }
  function readFromCanvas(canvas){
    if(typeof window.jsQR!=='function')throw Error('ไม่พบตัวอ่าน QR บนอุปกรณ์');
    const context=canvas.getContext('2d',{willReadFrequently:true});
    if(!context)throw Error('ไม่สามารถอ่านภาพจากกล้องได้');
    const pixels=context.getImageData(0,0,canvas.width,canvas.height);
    return window.jsQR(pixels.data,pixels.width,pixels.height,
      {inversionAttempts:'attemptBoth'})?.data||'';
  }
  async function startCamera(){
    if(busy||!activeKey){notice('กรุณาเลือกรายการแข่งขันก่อนเปิดกล้อง','error');return;}
    if(!navigator.mediaDevices?.getUserMedia){
      notice('เปิดกล้องไม่ได้ · ใช้เลขใบสมัครแทน','error');
      return;
    }
    stopCamera();
    const generation=scanGeneration;
    try{
      const opened=await navigator.mediaDevices.getUserMedia({
        audio:false,video:{facingMode:{ideal:'environment'},
          width:{ideal:1280},height:{ideal:720}}
      });
      if(generation!==scanGeneration||!onPage()||!activeKey){
        opened.getTracks().forEach(track=>track.stop());return;
      }
      stream=opened;
      const video=el('bang1QrVideo');
      video.srcObject=stream;
      el('bang1QrCamera').hidden=false;
      el('bang1QrStart').disabled=true;
      el('bang1QrStop').disabled=false;
      el('bang1QrStop').hidden=false;
      await video.play();
      notice('เล็ง QR ในกรอบสีเขียว');
      lastDecodeAt=0;
      const scan=time=>{
        if(generation!==scanGeneration||!stream||!onPage())return;
        if(time-lastDecodeAt>=120&&video.readyState>=2&&video.videoWidth>0){
          lastDecodeAt=time;
          const canvas=el('bang1QrCanvas');
          const scale=Math.min(1,960/video.videoWidth);
          canvas.width=Math.max(1,Math.round(video.videoWidth*scale));
          canvas.height=Math.max(1,Math.round(video.videoHeight*scale));
          const context=canvas.getContext('2d',{willReadFrequently:true});
          context.drawImage(video,0,0,canvas.width,canvas.height);
          try{
            const decoded=readFromCanvas(canvas);
            if(decoded){void lookup(decoded);return;}
          }catch(error){stopCamera();notice(error.message,'error');return;}
        }
        frameId=requestAnimationFrame(scan);
      };
      frameId=requestAnimationFrame(scan);
    }catch(error){
      stopCamera();
      notice('เปิดกล้องไม่ได้ · อนุญาตกล้องหรือกรอกเลขใบสมัคร','error');
    }
  }
  async function setAthlete(event){
    const input=event.target.closest('input[data-athlete]');
    if(!input||busy||!scannedRegId||!activeKey)return;
    const checked=input.checked;
    input.disabled=true;busy=true;
    notice(checked?'กำลังบันทึกการรายงานตัว...':'กำลังยกเลิกการรายงานตัว...');
    try{
      const result=await request('live_runner_set',{
        regId:scannedRegId,athleteKey:input.dataset.athlete,checked
      });
      const state=await request('live_manager_data');
      applyState(state);
      notice(checked?'✓ เช็กชื่อแล้ว':'✓ ยกเลิกชื่อแล้ว','success');
    }catch(err){
      notice(err.message||'บันทึกไม่สำเร็จ','error');
      try{applyState(await request('live_manager_data'));}catch(_){}
      lastTeamHash=''; // Force visual state to match the server after an error.
      if(snapshot){
        const team=(snapshot.teams||[]).find(x=>Number(x.regId)===scannedRegId);
        if(team)renderTeam(team);
      }
    }finally{busy=false;}
  }
  function setup(){
    if(!el('page-qr-checkin'))return;
    el('bang1QrFixture').addEventListener('change',()=>void selectFixture());
    el('bang1QrFixtureTrigger').addEventListener('click',()=>{
      if(pickerOpen)closePicker();else openPicker();
    });
    el('bang1QrFixtureClose').addEventListener('click',()=>closePicker(true));
    el('bang1QrFixtureSearch').addEventListener('input',event=>{
      pickerQuery=event.target.value;renderPicker();
      el('bang1QrFixtureList').scrollTop=0;
    });
    el('bang1QrFixturePopover').querySelectorAll('[data-round]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        pickerRound=btn.dataset.round;renderPicker();
        el('bang1QrFixtureList').scrollTop=0;
        if(window.matchMedia('(pointer: fine)').matches)
          el('bang1QrFixtureSearch').focus({preventScroll:true});
      });
    });
    el('bang1QrFixturePopover').addEventListener('keydown',pickerKeydown);
    document.addEventListener('pointerdown',event=>{
      if(!pickerOpen)return;
      const trigger=el('bang1QrFixtureTrigger'),menu=el('bang1QrFixturePopover');
      if(!menu.contains(event.target)&&!trigger.contains(event.target))closePicker();
    });
    window.addEventListener('resize',positionPicker);
    document.addEventListener('scroll',positionPicker,true);
    el('bang1QrStart').addEventListener('click',()=>void startCamera());
    el('bang1QrStop').addEventListener('click',()=>{stopCamera();notice('ปิดกล้องแล้ว');});
    el('bang1QrManualSubmit').addEventListener('click',()=>{
      void lookup(el('bang1QrManual').value.trim());
    });
    el('bang1QrManual').addEventListener('keydown',event=>{
      if(event.key==='Enter'){event.preventDefault();void lookup(event.target.value.trim());}
    });
    el('bang1QrNext').addEventListener('click',()=>{
      resetCard();void startCamera();
    });
    el('bang1QrResult').addEventListener('change',event=>void setAthlete(event));
    const page=el('page-qr-checkin');
    new MutationObserver(()=>{
      if(onPage()){
        if(permitted())void refresh();
        else notice('บัญชีนี้ไม่ได้รับสิทธิ์เช็กชื่อด้วย QR','error');
      }else{stopCamera();resetCard();closePicker();}
    }).observe(page,{attributes:true,attributeFilter:['class']});
    document.addEventListener('visibilitychange',()=>{
      if(document.hidden){stopCamera();closePicker();}
      else if(onPage())void refresh();
    });
    window.addEventListener('pagehide',()=>{stopCamera();closePicker();});
    setInterval(()=>{
      if(onPage()&&!document.hidden&&!busy)void refresh();
    },3000);
    if(onPage())void refresh();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);
  else setup();
})();
