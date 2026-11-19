'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const js=fs.readFileSync('run/live/live.js','utf8');
const html=fs.readFileSync('run/live/index.php','utf8');
const css=fs.readFileSync('run/live/live.css','utf8');
assert(js.includes("const SOUND_PREFERENCE='bang1-live-sound-enabled'"),
  'The viewer needs a stable audio preference');
assert(js.includes("getItem(SOUND_PREFERENCE)!=='off'"),
  'Sound should be requested on the first visit, unless explicitly muted');
assert(js.includes("if(newsSoundDesired)void enableBreakingSound(true)"),
  'The live display attempts to start sound as soon as the page loads');
assert(js.includes("document.addEventListener('pointerdown',unlockSoundOnFirstGesture"),
  'Browser-restricted sound should unlock with the first user gesture');
assert(js.includes("gain.gain.exponentialRampToValueAtTime(.20"),
  'The original fanfare has a stronger but controlled sound level');
assert(html.includes('id="liveSoundEnable"')&&html.includes('id="liveSoundPrompt"'),
  'The blocked-autoplay fallback must offer a one-tap sound control');
assert(html.includes('live.js?v=20261119-autosound-volume'),
  'The browser must reload the new sound implementation');
assert(css.includes('.live-sound-prompt[hidden]{display:none!important}'),
  'Audio prompt must not obscure results after sound is enabled');
const section=js.slice(js.indexOf('  function updateNewsAudioButtons(){'),
  js.indexOf('  function render(payload){'));
assert(section.includes('async function enableBreakingSound('));
const buttons={};
const prompt={hidden:true};
const contextState={running:false,starts:0};
const Audio=function(){this.state='suspended';this.currentTime=0;this.destination={};};
Audio.prototype.resume=function(){this.state='running';contextState.running=true;return Promise.resolve()};
Audio.prototype.suspend=function(){this.state='suspended';return Promise.resolve()};
Audio.prototype.createOscillator=function(){
  return {type:'',frequency:{setValueAtTime(){}},connect(){},
    start(){contextState.starts++},stop(){}};
};
Audio.prototype.createGain=function(){
  return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}};
};
const ctx={
  newsSoundEnabled:false,newsAudio:null,newsSoundDesired:true,soundWelcomePlayed:false,
  soundButtons:['newsSoundLive','newsSoundSport','newsSoundBreaking'],
  el:id=>id==='liveSoundPrompt'?prompt:(buttons[id]??={
    setAttribute(name,value){this[name]=value},textContent:'',title:''
  }),
  window:{AudioContext:Audio},
  saveNewsSoundPreference(enabled){ctx.saved=enabled},
  console
};
vm.createContext(ctx);
vm.runInContext(section+'\nthis.enableSound=enableBreakingSound;this.toggle=toggleBreakingSound;',ctx);
(async()=>{
  assert.equal(await ctx.enableSound(true),true,
    'A user-gesture-enabled AudioContext must resume');
  assert.equal(ctx.newsSoundEnabled,true);
  assert.equal(prompt.hidden,true);
  assert(contextState.starts>0,'Starting sound should play the short welcome fanfare');
  ctx.toggle();
  assert.equal(ctx.newsSoundEnabled,false,'Viewer can mute at any time');
  assert.equal(ctx.saved,false,'Mute preference must persist');
  assert.equal(prompt.hidden,true,'Explicit mute should not show sound prompt');
  console.log('PASS LIVE auto sound, audible jingle, high gain, gesture fallback and mute');
})().catch(e=>{console.error(e);process.exitCode=1});
