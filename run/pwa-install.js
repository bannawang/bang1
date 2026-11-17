/* Installable online PWA: never caches private runner or LIVE responses. */
(function(){
  'use strict';
  let deferredPrompt=null;
  let accepted=false;
  const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||
    window.navigator.standalone===true;
  const ios=()=>{
    const ua=navigator.userAgent||'';
    return /iPad|iPhone|iPod/.test(ua)||
      (/Macintosh/.test(ua)&&navigator.maxTouchPoints>1);
  };
  function update(){
    const button=document.getElementById('bang1PwaInstall');
    if(!button)return;
    button.hidden=standalone()||accepted||(!deferredPrompt&&!ios());
  }
  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();
    deferredPrompt=event;
    update();
  });
  window.addEventListener('appinstalled',()=>{
    accepted=true;deferredPrompt=null;update();
  });
  async function install(){
    if(standalone())return;
    if(deferredPrompt){
      const p=deferredPrompt;
      deferredPrompt=null;
      try{
        await p.prompt();
        const result=await p.userChoice;
        accepted=result?.outcome==='accepted';
      }catch(_){accepted=false;}
      update();
      return;
    }
    if(ios()){
      // Safari does not expose a programmable install prompt.
      window.alert('ติดตั้งบน iPhone/iPad: เปิดใน Safari → แตะ แชร์ → เพิ่มไปยังหน้าจอโฮม');
    }
  }
  function setup(){
    const btn=document.getElementById('bang1PwaInstall');
    if(!btn)return;
    btn.addEventListener('click',()=>void install());
    update();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);
  else setup();
})();