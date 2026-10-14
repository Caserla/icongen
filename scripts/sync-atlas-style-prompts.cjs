const fs = require("node:fs");
const path = require("node:path");
const { descriptions: previewStylePrompts } = require("./rebuild-style-strawberries.cjs");

const root = path.resolve(__dirname, "..");
const catalogPath = path.join(root, "docs/design/svg-style-prompts-v2.json");
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));

const styles = catalog.styles.map((style) => {
  const previewStylePrompt = previewStylePrompts[style.id];
  if (!previewStylePrompt) throw new Error(`Missing SVG preview-master prompt for ${style.id}`);
  const previousProductionStylePrompt = style.previousProductionStylePrompt
    || style.productionStylePrompt
    || style.stylePrompt;
  return {
    ...style,
    previousProductionStylePrompt,
    previewStylePrompt,
    stylePrompt: previewStylePrompt,
    source: "scripts/rebuild-style-strawberries.cjs (historical preview metadata; production rules are versioned separately)",
  };
});

fs.writeFileSync(catalogPath, `${JSON.stringify({
  ...catalog,
  styles,
}, null, 2)}\n`);
require("./sync-production-style-prompts.cjs");
console.log(`Synchronized ${styles.length} historical preview descriptions without replacing production rules.`);
