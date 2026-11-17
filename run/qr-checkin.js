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
    n.textContent=String(value??'');
    n.dataset.kind=kind;
  };
  function stopCamera(){
    scanGeneration++;
    if(frameId)cancelAnimationFrame(frameId);
    frameId=0;
    if(stream){stream.getTracks().forEach(track=>track.stop());stream=null;}
    const video=el('bang1QrVideo');
    if(video){video.pause();video.srcObject=null;}
    const panel=el('bang1QrCamera');if(panel)panel.hidden=true;
    const stop=el('bang1QrStop');if(stop)stop.disabled=true;
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
  function updateOptions(data){
    const opts=[...(data?.fixtures||[]),...(data?.pendingFinals||[])];
    const signature=JSON.stringify(opts.map(f=>
      [f.key,f.eventNumberLabel,f.eventName,f.round,f.order,f.pendingFinal,f.qualifiedFinal]));
    const select=el('bang1QrFixture');if(!select)return;
    if(signature!==optionsHash){
      optionsHash=signature;
      const placeholder=new Option('— เลือกรายการแข่งขัน —','');
      select.replaceChildren(placeholder);
      opts.sort((a,b)=>Number(a.order||a.eventId||999999)-
        Number(b.order||b.eventId||999999));
      for(const f of opts){
        const option=new Option(fixtureLabel(f)+(f.pendingFinal?' · รอผลคัดเลือก':''),f.key);
        option.disabled=f.pendingFinal===true;
        select.add(option);
      }
    }
    select.value=activeKey||'';
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
      '</strong><small>ใบสมัคร #'+Number(team.regId)+
      (team.heat?' · ฮีท '+Number(team.heat):'')+
      (team.lane?' · ลู่ '+Number(team.lane):'')+'</small></div>';
    if(!Array.isArray(team.athletes)||team.athletes.length===0)
      markup+='<p class="bang1-qr-help">ยังไม่มีนักกรีฑาที่ได้รับการเลือกในรายการนี้</p>';
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
        (final?'รอบชิง · แก้ไขเฉพาะรอบคัดเลือก':
        checked?'✓ รายงานตัวแล้ว · เอาเครื่องหมายถูกออกเพื่อเปลี่ยนตัวได้':
        disabled?'ครบจำนวนแล้ว · ยกเลิกคนเดิมก่อน':'ยังไม่รายงานตัว')+
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
      notice('✅ สแกนสำเร็จ · '+result.school+' · เลือกนักกรีฑาที่มารายงานตัวได้เลย','success');
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
      notice('เบราว์เซอร์นี้ไม่รองรับกล้อง โปรดใช้รูป QR หรือกรอกเลขใบสมัคร','error');
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
      await video.play();
      notice('หันกล้องไปที่ QR บนใบสมัคร ให้ QR อยู่ภายในกรอบ');
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
      notice('เปิดกล้องไม่สำเร็จ โปรดอนุญาตสิทธิ์กล้อง หรือใช้รูป QR แทน','error');
    }
  }
  async function decodeFile(event){
    const file=event.target.files?.[0];
    event.target.value='';
    if(!file)return;
    if(!file.type.startsWith('image/')||file.size>8*1024*1024){
      notice('กรุณาเลือกไฟล์ภาพ QR ขนาดไม่เกิน 8 MB','error');return;
    }
    const url=URL.createObjectURL(file);
    try{
      const image=new Image();
      await new Promise((resolve,reject)=>{
        image.onload=resolve;image.onerror=reject;image.src=url;
      });
      const canvas=el('bang1QrCanvas'),scale=Math.min(1,1600/image.naturalWidth);
      canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
      canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
      canvas.getContext('2d',{willReadFrequently:true}).drawImage(image,0,0,canvas.width,canvas.height);
      const raw=readFromCanvas(canvas);
      if(!raw)throw Error('ไม่พบ QR ในรูปภาพนี้');
      await lookup(raw);
    }catch(err){notice(err.message||'อ่าน QR จากรูปภาพไม่สำเร็จ','error');}
    finally{URL.revokeObjectURL(url);}
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
      notice(result.message||'บันทึกรายงานตัวแล้ว','success');
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
    el('bang1QrStart').addEventListener('click',()=>void startCamera());
    el('bang1QrStop').addEventListener('click',()=>{stopCamera();notice('ปิดกล้องแล้ว');});
    el('bang1QrFile').addEventListener('change',event=>void decodeFile(event));
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
      }else{stopCamera();resetCard();}
    }).observe(page,{attributes:true,attributeFilter:['class']});
    document.addEventListener('visibilitychange',()=>{
      if(document.hidden)stopCamera();
      else if(onPage())void refresh();
    });
    window.addEventListener('pagehide',stopCamera);
    setInterval(()=>{
      if(onPage()&&!document.hidden&&!busy)void refresh();
    },3000);
    if(onPage())void refresh();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);
  else setup();
})();
