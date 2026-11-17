'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const live=fs.readFileSync('run/live-api.php','utf8');
const api=fs.readFileSync('run/api.php','utf8');
const ui=fs.readFileSync('run/live-manager.js','utf8');
const schedule=fs.readFileSync('run/event-management.php','utf8');
const final=fs.readFileSync('run/live-final-qualification.php','utf8');
const html=fs.readFileSync('run/legacy-app.html','utf8');
assert(!live.includes('if(!$checked && $preliminaryLock)'),
  'Qualifying selection may be unchecked or replaced via UI/API');
assert(!live.includes('lockOnConfirm'), 'No permanent qualifier flag is exposed');
assert(live.includes("db()->prepare('DELETE FROM race_athlete_checkins WHERE registration_id=? AND athlete_key=?')"),
  'Uncheck deletes only selected preliminary athlete check-in');
assert(live.includes('กรุณายกเลิกชื่อเดิมก่อนเลือกคนใหม่'),
  'Preliminary runner swap requires first unchecking existing runner at capacity');
assert(live.includes("SELECT id FROM registrations WHERE id=? FOR UPDATE"),
  'Simultaneous selections remain transactionally protected');
assert(schedule.includes('bang1_qualifying_final_entries($regs,$preliminaryRankings,$checkedByRegistration)'),
  'Qualified finalist roster derives from current prelim checkboxes');
assert(final.includes("array_key_exists('RunnerIDs',$entry)"),
  'Final reflects the selected athlete, never an unconfirmed substitute');
assert(live.includes("if(($state['active']['qualifiedFinal']??false)===true)"),
  'Qualified final cannot check in or substitute athlete through API');
assert(live.includes("&&!($team['qualifiedFinal']??false)"),
  'Final cannot be mutated as next fixture');
assert(ui.includes('const control=finalReadOnly'),
  'Qualified finals replace the checkbox with a noninteractive marker');
assert(ui.includes('bang1-final-readonly'), 'Qualified final has a read-only indicator');
assert(!ui.includes('data-lock-on-confirm'), 'Preliminary checkboxes are not permanently disabled');
assert(!ui.includes('ยืนยันแล้วไม่สามารถเปลี่ยนตัวได้'), 'Old irreversible dialog removed');
assert(ui.includes('เปลี่ยนตัวได้เฉพาะจากรายการรอบคัดเลือก'),
  'Users are instructed to change only the preliminary selection');
assert(html.includes('live-manager.js?v=20261117-prelim-edit-final-readonly5'),
  'Latest frontend cache key deployed');
assert(api.includes('ยืนยันตัวลงแข่งขันแล้ว ไม่สามารถเปลี่ยนรายชื่อนักกรีฑาในใบสมัครได้'),
  'Editing the underlying checked registration remains guarded; uncheck first');
console.log('PASS editable preliminary checkboxes; final view-only reflects selected starters');
