'use strict';
// Exercise the public ten-column school markup using the REAL rendering helpers.
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const file=fs.readFileSync('run/live/live.js','utf8');
const start=file.indexOf('  function athleteCard(');
const end=file.indexOf('  function paintSchools(',start);
assert(start>=0 && end>start,'Cannot locate LIVE school renderer');
const segment=file.slice(start,end);
const esc=value=>String(value??'').replace(/[&<>"']/g,
  char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const ctx={document:{addEventListener(){}},esc};
vm.createContext(ctx);
vm.runInContext(segment+'\nthis.schoolCell=schoolCell;this.schoolPositions=schoolPositions;this.schoolPositionLabel=schoolPositionLabel;',ctx);
function school(positions,registered=true){
  return {name:'โรงเรียนทดสอบ',registered,heats:[1,2],positions,logo:null,
    athletes:[{name:'นักกรีฑาทดสอบ',photo:null}]};
}
const html=ctx.schoolCell(school([{heat:2,lane:5},{heat:1,lane:3}]));
assert(html.includes('ฮีท 1 · ลู่ 3'),'Heat one must show its exact lane');
assert(html.includes('ฮีท 2 · ลู่ 5'),'Heat two must show its exact lane');
assert(html.indexOf('ฮีท 1 · ลู่ 3')<html.indexOf('ฮีท 2 · ลู่ 5'),'Heat labels must be sorted');
const noLane=ctx.schoolCell(school([{heat:1,lane:null}]));
assert(noLane.includes('ฮีท 1'),'Show heat when lane is unknown');
assert(!noLane.includes('ลู่ 0') && !noLane.includes('ลู่ null'),'Do not invent missing lanes');
const absent=ctx.schoolCell(school([],false));
assert(!absent.includes('school-heat-badge'),'Nonregistered schools have no assignments');
const page=fs.readFileSync('run/live/index.php','utf8');
assert(page.includes('live.js?v=20261119-autosound-volume'),'Frontend cache key must be updated');
console.log('PASS LIVE school headers show real heat and lane, including finals, with missing lanes omitted');
