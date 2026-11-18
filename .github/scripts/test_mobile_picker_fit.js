'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const manager=fs.readFileSync('run/live-manager.css','utf8');
const qr=fs.readFileSync('run/qr-checkin.css','utf8');
const html=fs.readFileSync('run/legacy-app.html','utf8');
const qrJs=fs.readFileSync('run/qr-checkin.js','utf8');
const managerJs=fs.readFileSync('run/live-manager.js','utf8');
assert(manager.includes('@media (max-width:620px)'), 'Responsive competition popover is required');
assert(manager.includes('grid-template-areas:"number copy meta"'),
  'Mobile cards should use the available right column for status and count');
assert(manager.includes('grid-area:meta;grid-column:3'),
  'Statuses must stay in the rightmost column, not below the main text');
assert(manager.includes('flex:0 0 auto'),
  'Scrolled competition options must not flex-shrink beneath their content');
assert(manager.includes('min-height:68px;height:auto'),
  'An option must grow with a long event name');
assert(manager.includes('white-space:normal;overflow-wrap:anywhere'),
  'Long Thai names and round labels must wrap instead of overflowing');
assert(manager.includes('font-size:clamp(12px,3.35vw,15px)'),
  'Main event name font must respond to phone width');
assert(qr.includes('#page-qr-checkin .bang1-fixture-trigger-copy strong') &&
       qr.includes('white-space:normal;overflow:visible;text-overflow:clip'),
  'QR selected race label must not be truncated');
assert(html.includes('live-manager.css?v=20261118-mobile-picker-right-meta') &&
       html.includes('qr-checkin.css?v=20261118-mobile-picker-fit'),
  'Both stylesheets must refresh in the installed PWA');
assert(qrJs.includes('id=')===false || qrJs.includes('bang1QrFixturePopover'),
  'QR controls still use the original picker');
assert(managerJs.includes('bang1FixtureList'),
  'Manager event selector must retain original event logic');
console.log('PASS responsive QR/Manager race selector: card height, text wrapping, mobile fonts, cache keys');
