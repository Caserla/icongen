// One-time migration of legacy neutral CSS colors to reversible theme tokens.
const fs = require('node:fs');
const postcss = require('postcss');
const files = ['src/app/globals.css', 'src/features/library/library.module.css'];
if (files.some(file => fs.readFileSync(file, 'utf8').includes('--ui-surface-'))) {
  console.log('Neutral theme migration already applied; no files changed.');
  process.exit(0);
}
const tokens = new Map();
function neutral(hex) {
  let h = hex.slice(1);
  if (h.length === 3 || h.length === 4) h = [...h].map(c => c+c).join('');
  if (![6,8].includes(h.length)) return null;
  const rgb = [0,2,4].map(i => parseInt(h.slice(i,i+2),16));
  if (Math.max(...rgb)-Math.min(...rgb)>18) return null;
  const n = rgb.reduce((a,b)=>a+b)/3;
  const alpha = h.length===8 ? parseInt(h.slice(6),16)/255 : 1;
  return {n,alpha};
}
function convert(value, prop) {
  return value.replace(/#[\da-f]{3,8}\b/gi, hex => {
    const c = neutral(hex); if(!c) return hex;
    const kind = /color$/.test(prop) && !/border|outline|background/.test(prop) ? 'ink' : /border|outline/.test(prop) ? 'line' : 'surface';
    const key = `--ui-${kind}-${hex.slice(1).toLowerCase()}`;
    const v = kind==='ink' ? (c.n>180?'#1d1d1d':c.n>95?'#666762':c.n<65?'#ffffff':'#858680') : kind==='line' ? (c.n>180?'#343530':'#d8d9d3') : c.n<30?'#ffffff':c.n<65?'#f0f1ec':c.n<130?'#d8dad2':c.n>210?'#252622':'#656760';
    tokens.set(key, c.alpha===1 ? v : `color-mix(in srgb, ${v} ${Math.round(c.alpha*100)}%, transparent)`);
    return `var(${key}, ${hex})`;
  });
}
for(const file of files) {
  const root = postcss.parse(fs.readFileSync(file,'utf8'));
  root.walkRules(rule => {
    if(rule.selector.includes('data-theme="light"')) { rule.remove(); return; }
    if(/butter-|motion-reveal|icon-drop|:root|img|\[alt|saturation|hue|stopTrack|gradientStops|colorSample|previewIcon|downloadGroup/.test(rule.selector)) return;
    let parent=rule.parent; while(parent) {if(parent.type==='atrule' && /keyframes|theme/.test(parent.name))return;parent=parent.parent;}
    rule.walkDecls(d => {
      if(!/^(background(-color)?|color|border(-[\w-]+)?|outline(-color)?|-webkit-text-fill-color|caret-color)$/.test(d.prop))return;
      if(/gradient|url\(|var\(/.test(d.value))return;
      d.value = convert(d.value.replace(/\bwhite\b/g,'#ffffff').replace(/\bblack\b/g,'#000000'), d.prop);
    });
  });
  fs.writeFileSync(file,root.toString());
}
const defs = `\n/* Neutral tokens: legacy dark fallbacks stay intact; light values are shared by every component. */\nhtml[data-theme="light"] {\n${[...tokens].sort().map(([k,v])=>`  ${k}: ${v};`).join('\n')}\n}\n`;
fs.appendFileSync(files[0],defs);
