'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('run/live/index.php','utf8');
const css=fs.readFileSync('run/live/live.css','utf8');
const js=fs.readFileSync('run/live/live.js','utf8');
const manager=fs.readFileSync('run/live-manager.js','utf8');
const app=fs.readFileSync('run/legacy-app.html','utf8');
assert(!/liveMusicDock|liveMusicVideo|liveMusicRestore|youtube-nocookie\.com\/embed|<iframe/i.test(html),
 'Public LIVE must not contain a video popup or embedded player');
assert(!/\.live-music-dock|\.live-music-video|\.live-music-restore/.test(css),
 'Remove unused YouTube dock styling from LIVE');
assert(html.includes('id="sportShowcase"')&&html.includes('id="schoolGrid"'),
 'Preserve both SPORT and CHECK-IN broadcast DOM');
assert(manager.includes("sport?'✅ Check-in':'🏃 Sport'")&&
 manager.includes("update('live_display_set',{mode})"),
 'Manager must keep the existing SPORT/CHECK-IN switch');
assert(app.includes('bang1SportToggle'),
 'Live manager toggle must still exist in the main application');
assert(js.includes("payload.display?.mode==='sport'?'sport':'checkin'"),
 'Broadcast mode follows the server, not music or viewer state');
assert(js.includes("showcase.hidden=mode!=='sport'"),
 'Each server mode must toggle the sport showcase');
assert(js.includes('startAmbientMusic()')&&js.includes('stopAmbientMusic()'),
 'The original continuous audio track should start/stop with sound settings');
assert(js.includes('signal:controller.signal')&&js.includes('controller.abort(),12000'),
 'A stalled LIVE API must be timed out so retries can continue');
assert(css.includes('.school-grid>.loading{'),
 'A failed initial load should show legible status over white board');
assert(html.includes('live.js?v=20261119-restored-live-audio'),
 'Browser must load the updated LIVE JavaScript');
const start=js.indexOf('  function render(payload){');
const end=js.indexOf('  async function poll(){',start);
assert(start>=0&&end>start,'Missing public LIVE mode renderer');
const elements={};
const makeElement=()=>({textContent:'',hidden:false,style:{},
 classList:{items:new Set(),toggle(name,on){if(on)this.items.add(name);else this.items.delete(name)},
  remove(name){this.items.delete(name)}},setAttribute(){}});
const get=id=>elements[id]??(elements[id]=makeElement());
const ctx={el:get,loaded:false,lastPayload:null,clockOffsetMs:0,lastMode:null,
 lastSignature:'',lastSportBoardSignature:'',sportSlideIndex:-1,sportRetryAt:0,
 sportSlideToken:0,sportCache:new Map(),sportPending:new Map(),
 sportManualRosterPage:0,Date,stamp:()=> '00:00:00',
 document:{querySelector:()=>get('liveScreen')},setNextLabels:()=>{},
 renderSportCycle:()=>{ctx.sportCalls++},renderCheckin:()=>{ctx.checkinCalls++},
 renderRecentResults:()=>{},watchOfficialBreakingResults:()=>{},
 sportCalls:0,checkinCalls:0};
vm.createContext(ctx);
vm.runInContext(js.slice(start,end)+'\nthis.runRender=render;',ctx);
ctx.runRender({display:{mode:'sport'},serverNowMs:Date.now()});
assert.equal(elements.sportShowcase.hidden,false,'Sport server mode shows sport screen');
assert.equal(ctx.sportCalls,1);
ctx.runRender({display:{mode:'checkin'},serverNowMs:Date.now()});
assert.equal(elements.sportShowcase.hidden,true,'Check-in server mode restores check-in screen');
assert.equal(ctx.checkinCalls,1);
console.log('PASS no YouTube popup, live Sport/Check-in modes retained, audio loop and API timeout');
