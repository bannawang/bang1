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
assert(app.includes("navigator.mediaDevices.getUserMedia"),
  'User-initiated camera permission supported');
assert(app.includes("typeof window.jsQR!=='function'"),
  'Local QR decoder presence is verified');
assert(app.includes("stream.getTracks().forEach(track=>track.stop())"),
  'Camera tracks stop when leaving scanner');
assert(app.includes("new MutationObserver"),'Scanner stops when leaving QR menu');
assert(app.includes("if(document.hidden)stopCamera()"),'Camera stops on visibility loss');
assert(app.includes("const control=final?"),'Final roster does not render checkboxes');
assert(html.includes('id="bang1QrFile"')&&html.includes('id="bang1QrManual"'),
  'Camera fallback paths are available');
assert(html.includes('role-guidance.js?v=20261117-admin-qr-access'),
  'Role menu change busts browser cache');
assert(html.includes('qr-checkin.js?v=20261117-admin-qr-access'),
  'QR scanner permissions bust browser cache');
console.log('PASS: authorized QR camera lookup, correct fixture, shared attendance, final read-only, camera cleanup');
