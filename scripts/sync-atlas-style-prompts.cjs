const fs = require("node:fs");
const path = require("node:path");
const { descriptions: previewStylePrompts } = require("./rebuild-style-strawberries.cjs");

const root = path.resolve(__dirname, "..");
const catalogPath = path.join(root, "docs/design/svg-style-prompts-v2.json");
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));

const adaptation = `Apply the authoritative preview-master style below to the requested subject as one standalone SVG icon.
Do not reproduce the strawberry used by the preview master; preserve only its visual treatment and apply it to the requested subject.
Do not preserve or imitate the strawberry subject geometry. Preserve only the preview's stroke character, geometric discipline, color-role logic, material treatment, dimensionality and permitted effects. Construct the requested subject from its own canonical proportions on the 24-unit icon grid.
The common SVG safety and editability constraints remain mandatory, but they must not flatten or replace the selected visual style.`;

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
    promptTemplate: `${catalog.common}\nSTYLE_ID: ${style.id}\nAUTHORITATIVE_PREVIEW_STYLE: ${previewStylePrompt}\n${adaptation}`,
    source: "scripts/rebuild-style-strawberries.cjs (same contract used by the visible 46 SVG preview masters)",
  };
});

fs.writeFileSync(catalogPath, `${JSON.stringify({
  ...catalog,
  version: "2.3",
  status: "wired to production SVG generation; visible SVG preview-master prompts are authoritative",
  styles,
}, null, 2)}\n`);

console.log(`Synchronized ${styles.length} production prompts with visible SVG preview-master prompts.`);
