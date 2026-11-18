'use strict';
// Regression: qualifying heats must also have a fully green saved-results row.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const css=fs.readFileSync('run/staff-results.css','utf8');
const js=fs.readFileSync('run/staff-results.js','utf8');
const html=fs.readFileSync('run/legacy-app.html','utf8');
assert(js.includes("(f.isSaved?' bang1-staff-saved':'')"),'All saved fixtures must get class');
assert(js.includes("(f.round==='ชิงชนะเลิศ'?' bang1-staff-final':'')"),'Final class must remain');
assert(css.includes('#bang1StaffResults .bang1-staff-fixture.bang1-staff-final {\n  background:#fef3c7;'),
    'Pending finals must be yellow');
assert(css.includes('#bang1StaffResults .bang1-staff-fixture.bang1-staff-saved {\n  background:#c9f7df;'),
    'Every saved heat must have a green background');
assert(!css.includes('.bang1-staff-fixture.bang1-staff-final.bang1-staff-saved'),
    'Saved green must not depend on round');
assert(html.includes('staff-results.css?v=20261118-saved-any-heat-green'),
    'Browser must use revised stylesheet');
console.log('PASS saved qualifiers/finals green; pending finals yellow');
