'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const js=fs.readFileSync('run/live-manager.js','utf8');
const css=fs.readFileSync('run/live-manager.css','utf8');
const html=fs.readFileSync('run/legacy-app.html','utf8');
const begin=js.indexOf('  function isFinalFixture(f){');
const end=js.indexOf('  function fixtureTitle(f){',begin);
assert(begin>=0&&end>begin,'Fixture helpers found');
const c={};vm.createContext(c);
vm.runInContext(js.slice(begin,end),c);
const ready={key:'final-31',eventId:31,round:'รอบชิง',teams:6,qualifiedFinal:true};
const direct={key:'direct-67',eventId:67,round:'รอบชิง',teams:8};
const prelim={key:'heat-23',eventId:23,round:'คัดเลือก',teams:5};
assert.equal(c.isQualifiedFinal(ready),true,'Validated qualifying final recognized');
assert.equal(c.isQualifiedFinal(direct),false,'Direct final does not receive qualified badge');
assert.equal(c.isQualifiedFinal(prelim),false,'Preliminary heat not a final');
const pending={key:'pending-final-31',eventId:31,round:'รอบชิง',
  pendingFinal:true,qualificationSavedHeats:1,qualificationRequiredHeats:2};
assert.equal(c.isPendingFinal(pending),true,'Waiting final visible but not broadcastable');
assert.equal(c.isQualifiedFinal(pending),false,'Pending never presented as ready');
assert.deepEqual(Array.from(c.livePickerSorted([prelim,direct,pending,ready]),x=>x.key),
  ['final-31','pending-final-31','heat-23','direct-67'],
  'Ready and pending finals first, others retain original order');
assert(js.includes("readyKeys=new Set(fixtures.filter(isQualifiedFinal)"),'Newly confirmed finals detected');
assert(js.includes("renderFixtureOptions(newReadyFinal)"),'Menu refreshes and highlights new final');
assert(js.includes("const cadence=fixtureMenuOpen?1500:4000"),'Picker refreshes faster than normal view');
assert(js.includes("void refresh();"),'Opening picker checks fresh server state');
assert(js.includes('พร้อมปล่อย LIVE'),'Ready-final status is visible');
assert(js.includes('const pending=Array.isArray(data.pendingFinals)'),'Manager reads pending finalists');
assert(js.includes('option.disabled=isPendingFinal(f)'),'Pending fixture cannot be selected');
assert(js.includes('ยังไม่เปิดให้ปล่อย LIVE'),'Pending final label explains status');
assert(css.includes('.bang1-fixture-option.is-qualified-final'),'Ready finals are visually distinct');
assert(html.includes('live-manager.js?v=20261117-qualifier-pending2'),'Manager browser cache is invalidated');
console.log('PASS LIVE qualified-final chooser: priority, ready badge, fast refresh and unchanged direct-finals');
