'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('run/legacy-app.html','utf8');
function section(a,b){
 const start=html.indexOf(a),end=html.indexOf(b,start+1);
 assert(start>=0 && end>start,'Cannot locate '+a);
 return html.slice(start,end);
}
const code=section('function bang1QualifierSourceLabel(', 'function bang1UpdateScheduleSchoolCount(')+
  '\n'+section('function getProgramCss() {','function printScheduleProgram() {');
const ctx={
 escSchedule:value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;')
   .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'),
 Date
};
vm.createContext(ctx);
vm.runInContext(code+'\nthis.waitLabel=bang1QualifierSourceLabel;this.render=buildProgramHtml;',ctx);
const prelim=(id,heat,name='วิ่ง 60 เมตร (6 ปี ชาย)')=>({
 index:id,EventID:id,EventName:name,Category:'วิ่งเดี่ยว',Level:'อนุบาล',
 Gender:'ชาย',Remark:'คัดเลือก',Stage:'คัดเลือก',Heat:heat,
 SlotStatus:'drawn',RegisteredTeams:5,schools:[
  {SchoolName:'โรงเรียนบ้านนาวัง',Lane:heat+1,RunnerName:'เด็กชาย ก,เด็กชาย ข'}
 ]
});
const a=prelim(23,1),b=prelim(24,2);
const waiting={index:31,EventID:31,EventName:a.EventName,
 Category:a.Category,Level:a.Level,Gender:a.Gender,
 Remark:'คัดเลือก',Stage:'ชิงชนะเลิศ',SlotStatus:'waiting',
 QualificationSavedHeats:1,QualificationRequiredHeats:2,schools:[]};
const other=prelim(25,1,'วิ่ง 60 เมตร (6 ปี หญิง)');
other.Gender='หญิง';
const rows=[a,b,waiting,other];
const label=ctx.waitLabel(waiting,rows);
assert.equal(label,'รอผลการแข่งขัน วิ่ง 60 เมตร (6 ปี ชาย) รายการที่ 23-24');
const rendered=ctx.render(rows);
assert(rendered.includes(label),'Print preview must show exact source race and event range');
assert(!rendered.includes('⏳ รอผล'),'No redundant waiting prefix inside the program card');
assert(!rendered.includes('บันทึกผลแล้ว 1/2 ฮีท'),'Do not show partial qualification counters in print');
assert(!rendered.includes('program-waiting-marker'),'Do not render separate waiting label');
const noResults=ctx.render([a,b,{...waiting,QualificationSavedHeats:0}]);
assert(!noResults.includes('บันทึกผลแล้ว 0/2 ฮีท'),
  'The printout must not show zero-of-two heat counters either');
assert(noResults.includes(label),'Keep original source-specific waiting line');
assert(rendered.includes('program-number')&&rendered.includes('program-tag'),
  'Modern card includes a numbered label and round badges');
assert(rendered.includes('ลู่ 2')&&rendered.includes('โรงเรียนบ้านนาวัง'),
  'Do not lose original lanes and schools');
assert(rendered.includes('final-event waiting-event'),'Pending final gets a distinct styling');
assert(!rendered.includes('รอผลการแข่งขันรอบคัดเลือก'),
  'Printed pending reason must reference the source instead of generic copy');
assert(html.includes('bang1QualifierSourceLabel(r, rows)'),
  'Schedule table must also show precise source event numbers');
assert(html.includes("teamTextInRow.startsWith('รอผลการแข่งขัน')"),
  'Waiting row remains protected against expanding incomplete finals');
assert(html.includes('EventID: eventId')&&html.includes('QualificationSavedHeats: ev.QualificationSavedHeats'),
  'Print receives official event IDs and actual qualifier progress');
const sourceRows=[36,37,38,39].map((n)=>({
  EventID:n,index:n,EventName:'วิ่งผลัด 4X50 เมตร (8 ปี ชาย)',
  TeamCount:n===37||n===38?0:5,RegisteredTeams:n===37||n===38?0:5,
  Remark:'คัดเลือก',Stage:'คัดเลือก',Heat:n%2?'1':'2',
  SlotStatus:n===37||n===38?'not_drawn':'drawn',schools:[]
}));
const preserved=ctx.render(sourceRows);
for(const id of [36,37,38,39]){
  assert(preserved.includes('<strong>'+id+'</strong>'),
    'Configured program event '+id+' must remain printable even without enrolled schools');
}
assert(preserved.includes('ยังไม่มีใบสมัครในระบบสำหรับรายการหรือฮีทนี้'),
  'Empty races must show a factual empty-state instead of invented entrants');
const conditionalFinals=[37,38].flatMap((id)=>{
  const base={
    index:id,EventID:id,EventName:'วิ่ง 80 เมตร (6 ปี '+(id===37?'ชาย':'หญิง')+')',
    Category:'วิ่งเดี่ยว',Level:'อนุบาล',Gender:id===37?'ชาย':'หญิง'
  };
  return [1,2].map(heat=>({
    ...base,Heat:String(heat),Remark:'คัดเลือก',Stage:'คัดเลือก',
    RegisteredTeams:heat===1?5:id===37?4:5,
    SlotStatus:'drawn',
    schools:[{SchoolName:'โรงเรียนตัวอย่าง',Lane:heat+2,RunnerName:'นักกีฬา'}]
  })).concat([{...base,Heat:'ชิง',Remark:'คัดเลือก',Stage:'ชิงชนะเลิศ',
    SlotStatus:'waiting',RegisteredTeams:0,schools:[]}]);
});
const finalOnlyPrint=ctx.render(conditionalFinals);
assert(finalOnlyPrint.includes('ฮีท 1')&&finalOnlyPrint.includes('ฮีท 2'),
  'Preset finals above eight schools must show both preliminary heats');
assert(finalOnlyPrint.includes('รอบชิงชนะเลิศ')&&finalOnlyPrint.includes('รอผลคัดเลือก'),
  'Each race must retain a distinct pending final');
assert(finalOnlyPrint.includes('รอบคัดเลือกฮีท 1-2 รายการที่ 37'),
  'Conditional final must identify its own exact qualifying heats');
assert(!finalOnlyPrint.includes('ฮีท ชิง'),
  'A final is a separate stage, not a fictitious heat called ชิง');
const loadFn=section('function loadSchedule(silent = false) {','function onScheduleRowClick(');
const snapshot=loadFn.indexOf('scheduleEventsData = rows.slice();');
const filtered=loadFn.indexOf('rows = rows.filter(function (r) {');
assert(snapshot>=0&&filtered>=0&&snapshot<filtered,
  'Keep the entire official program for printing BEFORE filtering the on-screen table');
assert(!html.includes('const events = scheduleEventsData.filter(ev =>'),
  'No zero-team filtering may discard official event numbers during print');
const malicious={...waiting,EventName:'<img src=x onerror=alert(1)>'};
const sanitized=ctx.render([malicious]);
assert(!sanitized.includes('<img src=x onerror=alert(1)>'),
  'Schedule text is HTML-escaped before printing');
console.log('PASS modern printable athletics program and source-specific pending final captions');
