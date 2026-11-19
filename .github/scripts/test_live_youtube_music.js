'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('run/live/index.php','utf8');
const css=fs.readFileSync('run/live/live.css','utf8');
const video='0_tJ56tW0PI';
assert(html.includes('id="liveMusicDock"')&&html.includes('id="liveMusicVideo"'),
  'The official YouTube player must be present in the live screen');
assert(html.includes('www.youtube-nocookie.com/embed/'+video),
  'Use the exact user-provided video through the official embedded player');
assert(html.includes('autoplay=1&amp;loop=1&amp;playlist='+video),
  'The original audiovisual video should attempt autoplay and loop');
assert(html.includes('controls=1')&&html.includes('allow="autoplay; encrypted-media; picture-in-picture"'),
  'The native YouTube controls must remain accessible');
assert(!html.includes('youtube.com/watch?v='+video+'?download'),
  'Do not extract or download the original video audio');
assert(css.includes('.live-music-video{')&&css.includes('min-height:200px'),
  'YouTube player should be visible at a supported minimum height');
assert(css.includes('.live-music-dock[hidden],.live-music-restore[hidden]'),
  'Closed player must not appear on screen');
assert(html.includes("iframe.removeAttribute('src')")&&
       html.includes("iframe.setAttribute('src',url)"),
  'Closing the dock must STOP playback; reopening should restore the embedded player');
assert(html.includes('live.css?v=20261119-visible-youtube-loop'),
  'CSS cache must be refreshed');
console.log('PASS visible YouTube music embed with looping, native controls and stop-on-close');
