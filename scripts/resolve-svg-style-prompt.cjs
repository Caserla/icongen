const fs = require('node:fs');
const path = require('node:path');
const catalog = require('../docs/design/svg-style-prompts-v2.json');
function resolvePrompt(input) {
  if (!input || typeof input.subject !== 'string' || !input.subject.trim()) throw Error('subject is required');
  const style = catalog.styles.find(s => s.id === input.styleId);
  if (!style) throw Error('Unknown styleId: '+input.styleId);
  const data={subject:input.subject.trim(),size:input.size??24,theme:input.theme??'light',palette:input.palette??[],state:input.state??'solid',idPrefix:input.idPrefix??'icon'};
  if (!Number.isInteger(data.size) || data.size<16 || data.size>4096) throw Error('size must be 16–4096');
  if (!['light','dark'].includes(data.theme)) throw Error('Invalid theme');
  if (!['outline','solid'].includes(data.state)) throw Error('Invalid state');
  if (!Array.isArray(data.palette) || data.palette.some(c=>typeof c!=='string'||!/^#[0-9a-f]{6}$/i.test(c))) throw Error('palette must contain hex colors');
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(data.idPrefix)) throw Error('Invalid idPrefix');
  return style.promptTemplate.replace(/\{\{(inputJson|state)\}\}/g,(_,key)=>key==='inputJson'?JSON.stringify(data):data.state);
}
module.exports={resolvePrompt};
if(require.main===module){try{if(!process.argv[2])throw Error('Usage: node scripts/resolve-svg-style-prompt.cjs input.json');console.log(resolvePrompt(JSON.parse(fs.readFileSync(path.resolve(process.argv[2]),'utf8'))));}catch(e){console.error(e.message);process.exitCode=1;}}
