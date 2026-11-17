'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const live=fs.readFileSync('run/live-api.php','utf8');
const api=fs.readFileSync('run/api.php','utf8');
const ui=fs.readFileSync('run/live-manager.js','utf8');
const schedule=fs.readFileSync('run/event-management.php','utf8');
const final=fs.readFileSync('run/live-final-qualification.php','utf8');
assert(live.includes("if(!$checked && $preliminaryLock)"),'Server must reject unchecking a confirmed prelim runner');
assert(live.includes("lockOnConfirm'=>$round==='รอบคัดเลือก'"),'Lock is based on the official round');
assert(live.includes("SELECT id FROM registrations WHERE id=? FOR UPDATE"),'Concurrent slot selection remains atomic');
assert(schedule.includes('bang1_qualifying_final_entries($regs,$preliminaryRankings,$checkedByRegistration)'),
  'Final schedule uses checked runner data');
assert(final.includes("array_key_exists('RunnerIDs',$entry)"),'LIVE final must not substitute a reserve');
assert(ui.includes("const disabled=finalReadOnly||(lockOnConfirm&&checked)"),'Confirmed checkbox disabled');
assert(ui.includes('data-lock-on-confirm="1"'),'UI checkbox identifies irreversible selection');
assert(ui.includes("ยืนยันแล้วไม่สามารถเปลี่ยนตัวได้"),'Confirm before locking');
assert(api.includes('ยืนยันตัวลงแข่งขันแล้ว ไม่สามารถเปลี่ยนรายชื่อนักกรีฑาในใบสมัครได้'),
  'Registration changes blocked after check-in');
assert(api.includes('ยืนยันตัวลงแข่งขันแล้ว ไม่สามารถลบใบสมัครได้'),
  'Registration deletion blocked after check-in');
assert(api.includes('นักกรีฑารายนี้ได้รับการยืนยันตัวลงแข่งขันแล้ว ไม่สามารถลบหรือเปลี่ยนตัวได้'),
  'Runner deletion blocked after check-in');
console.log('PASS qualifying starter identity locked across check-in, registration, and deletion');
