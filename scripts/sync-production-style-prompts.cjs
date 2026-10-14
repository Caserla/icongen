// Mechanical compatibility-catalog sync. Edit svg-style-production-v3.json,
// not the derived productionStylePrompt/promptTemplate fields in the old file.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'docs/design/svg-style-production-v3.json'), 'utf8'));
const destination = path.join(root, 'docs/design/svg-style-prompts-v2.json');
const catalog = JSON.parse(fs.readFileSync(destination, 'utf8'));
if (catalog.styles.length !== Object.keys(source.styles).length) throw new Error('Style registry mismatch');
catalog.version = source.version;
catalog.productionSource = 'svg-style-production-v3.json';
catalog.status = 'Production uses versioned subject-independent contracts; previewStylePrompt is historical preview metadata only.';
catalog.common = source.common;
for (const style of catalog.styles) {
  const contract = source.styles[style.id];
  if (!contract) throw new Error(`Missing contract: ${style.id}`);
  style.productionStylePrompt = contract;
  style.promptTemplate = `${source.common}\nAUTHORING_VERSION: ${source.version}\nSELECTED_PRODUCTION_STYLE (${style.id}): ${contract}\nINPUT_JSON: {{inputJson}}\nReturn only one complete SVG, without markdown.`;
}
fs.writeFileSync(destination, JSON.stringify(catalog, null, 2) + '\n');
console.log(`Synced ${catalog.styles.length} production contracts; historical preview descriptions preserved.`);
