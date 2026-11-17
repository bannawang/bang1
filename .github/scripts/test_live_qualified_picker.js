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
const ready={key:'final-31',eventId:31,order:31,round:'รอบชิง',teams:6,qualifiedFinal:true};
const direct={key:'direct-67',eventId:67,order:67,round:'รอบชิง',teams:8};
const prelim={key:'heat-23',eventId:23,order:23,round:'คัดเลือก',teams:5};
assert.equal(c.isQualifiedFinal(ready),true,'Validated qualifying final recognized');
assert.equal(c.isQualifiedFinal(direct),false,'Direct final does not receive qualified badge');
assert.equal(c.isQualifiedFinal(prelim),false,'Preliminary heat not a final');
const pending={key:'pending-final-31',eventId:32,order:32,round:'รอบชิง',
  pendingFinal:true,qualificationSavedHeats:1,qualificationRequiredHeats:2};
assert.equal(c.isPendingFinal(pending),true,'Waiting final visible but not broadcastable');
assert.equal(c.isQualifiedFinal(pending),false,'Pending never presented as ready');
const group11={key:'combined-11-12',eventId:11,eventNumberLabel:'11–12',order:11,
  heat:0,heats:[1,2],round:'คัดเลือก'};
const group23={key:'combined-23-24',eventId:23,eventNumberLabel:'23–24',order:23,
  heat:0,heats:[1,2],round:'คัดเลือก'};
assert.deepEqual(Array.from(c.livePickerSorted([direct,pending,ready,group23,group11]),x=>x.key),
  ['combined-11-12','combined-23-24','final-31','pending-final-31','direct-67'],
  'LIVE picker follows original program order with one selection per qualifying race');
const scheduledLate={key:'source-100',eventId:3,order:100,round:'รอบคัดเลือก'};
assert.deepEqual(Array.from(c.livePickerSorted([scheduledLate,ready,prelim]),x=>x.key),
  ['heat-23','final-31','source-100'],
  'SourceOrder wins over EventID when published schedule defines a different order');
assert(js.includes("readyKeys=new Set(fixtures.filter(isQualifiedFinal)"),'Newly confirmed finals detected');
assert(js.includes("renderFixtureOptions();"),'Menu refreshes without jumping to a new final');
assert(js.includes("list.scrollTop=previousScroll"),'Keep the manager scroll position after live results update');
assert(js.includes("const cadence=fixtureMenuOpen?1500:4000"),'Picker refreshes faster than normal view');
assert(js.includes("void refresh();"),'Opening picker checks fresh server state');
assert(js.includes('พร้อมปล่อย LIVE'),'Ready-final status is visible');
assert(js.includes('const pending=Array.isArray(data.pendingFinals)'),'Manager reads pending finalists');
assert(js.includes('option.disabled=isPendingFinal(f)'),'Pending fixture cannot be selected');
assert(js.includes('ยังไม่เปิดให้ปล่อย LIVE'),'Pending final label explains status');
assert(css.includes('.bang1-fixture-option.is-qualified-final'),'Ready finals are visually distinct');
assert(html.includes('live-manager.js?v=20261117-program-order3'),'Manager browser cache is invalidated');
console.log('PASS LIVE manager chooser: grouped qualifying heats in official order, ready finals, fast refresh');
