'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const html=fs.readFileSync('run/legacy-app.html','utf8');
const manifest=JSON.parse(fs.readFileSync('run/manifest.webmanifest','utf8'));
const worker=fs.readFileSync('run/sw.js','utf8');
const install=fs.readFileSync('run/pwa-install.js','utf8');
const workflow=fs.readFileSync('.github/workflows/deploy.yml','utf8');
const icon=fs.readFileSync('run/icon.svg','utf8');
const mask=fs.readFileSync('run/icon-maskable.svg','utf8');
assert.equal(manifest.id,'/bang1/run/','PWA ID stable');
assert.equal(manifest.start_url,'/bang1/run/','App starts at original system URL');
assert.equal(manifest.scope,'/bang1/run/','PWA scope stays on Bang1 only');
assert.equal(manifest.display,'standalone','PWA launches without browser chrome');
assert.equal(manifest.lang,'th','Thai locale');
for(const [src,sizes,purpose] of [
  ['icon-192.png','192x192','any'],['icon-512.png','512x512','any'],
  ['icon-maskable-512.png','512x512','maskable']
])assert(manifest.icons.some(i=>i.src===src&&i.sizes===sizes&&i.purpose===purpose),
  'Manifest advertises '+src);
assert(html.includes('rel="apple-touch-icon" sizes="180x180" href="./icon-180.png"'),
 'iOS installs with a real PNG touch icon');
assert(html.includes('rel="manifest" href="./manifest.webmanifest"'),'Manifest linked');
assert(html.includes("navigator.serviceWorker.register('./sw.js',{scope:'./'})"),
  'Scoped service worker registered');
assert(worker.includes("self.addEventListener('install'")&&!worker.includes("addEventListener('fetch'"),
  'PWA never caches private attendance or personal information');
assert(icon.includes('viewBox="0 0 512 512"')&&mask.includes('viewBox="0 0 512 512"'),
  'Runner icons are SVGs with 512-square composition');
assert(mask.includes('transform="translate(100 100) scale(.61)"'),
  'Maskable artwork stays inside safe center zone');
assert(install.includes("window.addEventListener('beforeinstallprompt'"),
  'Android Chrome install event supported');
assert(install.includes("window.addEventListener('appinstalled'"),
  'Installed state tracked');
assert(install.includes("await p.prompt()"),'Tap to invoke real browser install prompt');
assert(install.includes("window.navigator.standalone===true"),'iOS home screen detection');
assert(install.includes('เพิ่มไปยังหน้าจอโฮม'),'iOS Safari install instructions');
assert(html.includes('pwa-install.js?v=20261117-install-v1'),
  'Install prompt script loaded by the app');
assert(workflow.includes('librsvg2-bin')&&workflow.includes('rsvg-convert --width=192')&&
       workflow.includes('rsvg-convert --width=512')&&
       workflow.includes('run/icon-maskable.svg --output=run/icon-maskable-512.png'),
  'Deployment generates real 192/512 maskable PNG icons');
assert(workflow.includes('Verify PWA manifest and raster icons on deployed host'),
  'Deployment checks installation assets on production');
console.log('PASS: secure installable Bang1 PWA, correct Thai icon sizes, maskable/iOS and install actions');
