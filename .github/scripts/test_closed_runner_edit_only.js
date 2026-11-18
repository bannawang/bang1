'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const api=fs.readFileSync('run/api.php','utf8');
const html=fs.readFileSync('run/legacy-app.html','utf8');
const save=api.split("if($action==='save_runner'){")[1]?.split("if($action==='delete_runner'){")[0];
const remove=api.split("if($action==='delete_runner'){")[1]?.split("if($action==='update_status'){")[0];
assert(save&&remove,'Runner API actions must exist');
assert(save.indexOf("$id=(int)($input['RunnerID']??0);") < save.indexOf("if($id<=0)require_feature('รับลงทะเบียนนักวิ่ง');"),
  'Creation guard must depend on the submitted RunnerID');
assert(!save.includes("if(!is_admin($u))require_feature('รับลงทะเบียนนักวิ่ง')"),
  'Admin must not bypass registration closure for additions');
assert(remove.includes("require_editor($u);require_feature('รับลงทะเบียนนักวิ่ง');"),
  'Deletion must be blocked for all roles while registration is closed');
assert(!remove.includes("if(!is_admin($u))require_feature('รับลงทะเบียนนักวิ่ง')"),
  'Admin must not bypass registration closure for deletions');
assert(save.includes("if($old)school_access($u,$old['school_name']);"),
  'Existing athlete updates must remain school-scoped');
assert(save.includes("status=\"รอตรวจสอบ\""),
  'Edits must return the athlete to review');
assert(html.includes('const canSave = hasSelection || runnerRegistrationOpen;'),
  'The closed form must still save corrections to a selected athlete');
assert(html.includes('const canDelete = hasSelection && runnerRegistrationOpen;'),
  'Deletion button must only appear during open registration');
assert(html.includes("if (!form.RunnerID && !runnerRegistrationOpen)"),
  'Client must block new athlete creation when closed');
assert(html.includes("if (!runnerRegistrationOpen) {\n    alert('ขณะนี้ปิดรับลงทะเบียนแล้ว ไม่สามารถลบนักวิ่งได้');"),
  'Client must reject deletion when closed');
assert(html.includes("runnerRegistrationOpen ? '<button type=\"button\""),
  'Inline Admin delete action must also be hidden when closed');
assert(!html.includes("['Admin','TopAdmin'].includes(currentUser.role)) allowEdit = true"),
  'No unconditional admin bypass of closure');
console.log('PASS: closed registration permits edits but blocks create/delete for all editors');
