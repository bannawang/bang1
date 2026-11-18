'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const html=fs.readFileSync('run/legacy-app.html','utf8');
const roles=fs.readFileSync('run/role-guidance.js','utf8');
const app=fs.readFileSync('run/qr-checkin.js','utf8');
const api=fs.readFileSync('run/api.php','utf8');
const backend=fs.readFileSync('run/live-api.php','utf8');
assert(html.includes('data-page="qr-checkin" hidden'),'Dedicated QR menu is present and starts hidden');
assert(html.indexOf('data-page="qr-checkin"')>html.indexOf('data-page="checkin"'),
  'QR menu follows normal attendance');
assert(html.includes('id="page-qr-checkin"'),'QR page exists');
assert(html.includes('id="bang1QrFixture"')&&html.includes('id="bang1QrCamera"'),
  'Event picker and camera area exist');
assert(html.includes('id="bang1QrFixtureTrigger"')&&html.includes('id="bang1QrFixturePopover"'),
  'QR uses a custom popover trigger, not a visible native select');
assert(html.includes('id="bang1QrFixtureSearch"')&&html.includes('id="bang1QrFixtureList"'),
  'QR supports searchable event selection');
assert(html.includes('id="bang1QrFixture" class="bang1-qr-native"'),
  'Native select only maintains state, hidden from users');
assert(html.includes('id="bang1QrFixtureResults"'),
  'QR custom menu reports filtered result counts');
assert(html.includes('id="bang1QrFixturePopover"')&&html.includes('data-round="prelim"')&&
  html.includes('data-round="final"'),
  'QR menu includes the same qualifying/final filters');
assert(html.includes('vendor/jsQR.js'),'Existing local QR decoder is used');
assert(roles.includes("pages:['login','checkin','qr-checkin','admin']"),
  'Granted Manager can access QR');
assert(roles.includes("pages:['login','admin']"),
  'Restricted Manager cannot access QR');
assert(roles.includes("pages:['login','runners','register','print','schedule','results','score-summary','checkin','qr-checkin','admin']"),
  'Admin and normalized TopAdmin may navigate to QR attendance');
assert(app.includes("user.role==='Admin'||user.role==='TopAdmin'"),
  'Frontend QR scanner includes Admin and TopAdmin');
assert(app.includes("user.role==='Manager'&&user.canLiveCheckin===true"),
  'Granted Manager retains QR access');
assert(api.includes("'live_qr_lookup'"),'API routes QR lookup');
assert(backend.includes("if($action==='live_qr_lookup')"),'Server has read-only QR resolver');
assert(backend.includes("if(!is_admin($u) &&"),'Server grants Admin/TopAdmin QR lookup');
assert(backend.includes("($u['role']??'')!=='Manager'"),'Server retains Manager-grant restriction');
assert(backend.includes("if($active===''||!hash_equals($active,$fixtureKey))"),
  'Server rejects another or stale active competition');
assert(backend.includes("foreach(($state['teams']??[]) as $candidate)"),
  'Server checks registration belongs to chosen official fixture');
assert(!backend.includes('QR check-in INSERT INTO race_athlete_checkins'),
  'Scanning itself never creates attendance');
assert(app.includes("request('live_qr_lookup',{qr:String(raw||''),fixtureKey:activeKey})"),
  'Scanning reads only registration roster');
assert(app.includes("request('live_runner_set',{"),
  'Checkbox shares existing attendance mutation');
assert(app.includes("request('live_manager_data')"),
  'Both tabs read the same live attendance state');
assert(app.includes("request('live_select',{fixtureKey:key})"),
  'Selecting a QR fixture updates the existing Live screen like the normal menu');
assert(app.includes('function renderPicker()')&&app.includes('function openPicker()')&&
  app.includes('function closePicker('),'QR custom picker is interactive');
assert(app.includes('function sortedFixtures(items)')&&app.includes('pickerOrder(a)-pickerOrder(b)'),
  'QR list uses official event order');
assert(app.includes('option.disabled=isPendingFinal(f)||busy')&&
  app.includes('if(isPendingFinal(f)||busy)return'),
  'Pending finals remain visible but cannot be activated');
assert(app.includes("if(pickerRound==='prelim'")&&app.includes("if(pickerRound==='final'"),
  'QR has qualifying and final filters');
assert(app.includes('document.body.appendChild(menu)')&&app.includes('positionPicker()'),
  'QR menu popover is outside clipped parent containers');
assert(app.includes("const query=pickerQuery.toLocaleLowerCase('th')"),
  'QR searches Thai program names');
assert(app.includes('closePicker();')&&app.includes("event.key==='Escape'"),
  'QR picker closes on page navigation and Escape');
assert(app.includes("navigator.mediaDevices.getUserMedia"),
  'User-initiated camera permission supported');
assert(app.includes("typeof window.jsQR!=='function'"),
  'Local QR decoder presence is verified');
assert(app.includes("stream.getTracks().forEach(track=>track.stop())"),
  'Camera tracks stop when leaving scanner');
assert(app.includes("new MutationObserver"),'Scanner stops when leaving QR menu');
assert(app.includes("if(document.hidden){stopCamera();closePicker();}"),
  'Camera and QR picker close on visibility loss');
assert(app.includes("const control=final?"),'Final roster does not render checkboxes');
assert(!html.includes('id="bang1QrFile"')&&html.includes('id="bang1QrManual"'),
  'Only numeric registration search remains; QR image upload removed');
assert(!app.includes('decodeFile(event)')&&!app.includes("bang1QrFile"),
  'No QR image upload code remains');
assert(html.includes('inputmode="numeric" enterkeyhint="search"'),
  'Registration number activates the mobile numeric keyboard');
assert(html.includes('id="bang1PwaInstall"'),
  'Compact PWA install entry exists');
assert(html.includes('id="bang1QrStatus"')&&html.includes('data-kind="idle" hidden'),
  'Idle status does not occupy screen space');
assert(!html.includes('รายการเรียงตามกำหนดการแข่งขัน โดยรวมฮีท'),
  'Long explanatory QR description removed');
assert(html.includes('role-guidance.js?v=20261117-admin-qr-access'),
  'Role menu change busts browser cache');
assert(html.includes('qr-checkin.js?v=20261117-mobile-clean-v3'),
  'Compact QR JavaScript busts browser cache');
assert(html.includes('qr-checkin.css?v=20261118-mobile-picker-fit'),
  'Compact QR CSS busts browser cache');

const css=fs.readFileSync('run/qr-checkin.css','utf8');
assert(css.includes('#page-qr-checkin .bang1-qr-native{display:none!important}'),
  'Default native dropdown is hidden in QR');
assert(css.includes('#page-qr-checkin .bang1-fixture-trigger'),
  'QR uses the same LIVE manager visual trigger');
const vm=require('node:vm');
const begin=app.indexOf('  const isFinalFixture=f=>');
const end=app.indexOf('  function updateOptions(data){',begin);
assert(begin>0&&end>begin,'QR picker pure helper code found');
const ctx={};
vm.createContext(ctx);
vm.runInContext(app.slice(begin,end),ctx);
ctx.items=[
  {key:'final31',eventId:31,order:31,round:'รอบชิง',qualifiedFinal:true},
  {key:'heat23',eventId:23,order:23,round:'รอบคัดเลือก',heats:[1,2]},
  {key:'pending32',eventId:32,order:32,round:'รอบชิง',pendingFinal:true},
  {key:'direct1',eventId:1,order:1,round:'รอบชิง'}
];
const ordered=vm.runInContext('sortedFixtures(items).map(x=>x.key)',ctx);
assert.deepEqual(Array.from(ordered),['direct1','heat23','final31','pending32'],
  'A ready final never jumps ahead of the published official event order');
assert.equal(vm.runInContext('isPendingFinal(items[2])',ctx),true,
  'Unready finals are distinguishable from selectable events');
assert.equal(vm.runInContext('isReadyFinal(items[0])',ctx),true,
  'Qualifying results populate a ready final row');
assert(css.includes('#page-qr-checkin .bang1-qr-scan-primary'),
  'Prominent phone-first scan button');
assert(css.includes('min-height:82px')&&css.includes('width:30px;height:30px'),
  'Large row and check target on smartphone');
assert(css.includes('body:has(#page-qr-checkin.active) .site-footer'),
  'Phone QR view hides the fixed footer');
console.log('PASS: compact mobile QR chooser, no image upload, numeric lookup, camera and shared check-ins');
