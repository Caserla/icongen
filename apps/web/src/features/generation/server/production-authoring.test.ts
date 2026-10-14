import assert from "node:assert/strict";
import test from "node:test";
import catalog from "../../../../../../docs/design/svg-style-prompts-v2.json";
import { productionAuthoringPrompt, productionStyleContract, parseProductionOutput } from "./production-authoring";
import { deriveStylePalette, uniformSmartBatchColors, projectPaletteGuidance } from "./smart-project-colors";

const theme = { primary: "#58CC02", secondary: "#1CB0F6", tertiary: "#FF9600", neutral: "#4B5563" };
test("all 46 actual prompts use clean unique production contracts and concrete design cards", () => {
  const unique = new Set();
  for (const { id } of catalog.styles) {
    unique.add(productionStyleContract(id));
    const prompt = productionAuthoringPrompt(id, { subject: "settings" });
    assert.doesNotMatch(prompt, /strawberry|calyx|seed marks|AUTHORITATIVE_PREVIEW_STYLE|Merely coloring an accessory/i);
    assert.match(prompt, /actual 24-unit positions/);
    assert.match(prompt, /data-part-id/);
    assert.match(prompt, /shared, mirrored or repeated/);
    assert.match(prompt, /Never stretch, squash, compress, shear, twist, pinch or warp/);
    assert.match(prompt, /"geometry":\{"version":"1","paths":\[/);
    assert.match(prompt, /designCard, geometry, then svg/);
    assert.doesNotMatch(prompt, /optional for naturally freeform/);
  }
  assert.equal(unique.size, 46);
  assert.throws(() => productionStyleContract("invalid"));
});
test("layered styles no longer require duplicate masses and the tile remains allowed", () => {
  assert.match(productionStyleContract("filled-duotone"), /A real attachment may carry the second tone/);
  assert.match(productionStyleContract("two-level"), /No mandatory offset layer/);
  assert.match(productionStyleContract("three-level"), /never invent unrelated parts/);
  assert.match(productionAuthoringPrompt("background-tile", {}), /except the backing tile/);
});
test("translucent glass styles keep rear attachments out of true openings", () => {
  for (const styleId of ["frosted", "tinted"]) {
    assert.match(productionStyleContract(styleId), /rounded cap, must not protrude into the opening/);
    assert.match(productionStyleContract(styleId), /Clip or mask the rear attachment at the frame boundary/);
    assert.match(productionAuthoringPrompt(styleId, {}), /attachment meets the outer rim/);
  }
});
test("projected rigid frames preserve paired contours and straight attachments", () => {
  assert.match(productionStyleContract("extruded"), /paired contours concentric and straight attachments/);
  assert.match(productionAuthoringPrompt("extruded", {}), /attachment roots pass behind uninterrupted near rims/);
  assert.match(productionStyleContract("isometric"), /paired contours of any rigid framed part from one shared center/);
  assert.match(productionAuthoringPrompt("isometric", {}), /Never skew or compress the whole assembled symbol/);
});
test("multi-stop gradients keep attachment corners out of cutouts", () => {
  assert.match(productionStyleContract("multi-stop"), /without any corner, cap or stroke protruding into a true cutout/);
});
test("special color families cannot inherit an old smart solid gray lock", () => {
  for (const styleId of ["mono-pastel", "neon-tube", "soft-glow", "filled-duotone", "gradient-fill", "frosted"]) {
    for (const surface of ["light", "dark"] as const) {
      const resolved = uniformSmartBatchColors({ mode: "smart", palette: theme, batchColor: "#34383D", locked: true, default: { mode: "solid", color: "#34383D" } }, styleId, surface) as Record<string, unknown>;
      assert.equal(resolved.locked, false);
      assert.equal(resolved.batchColor, undefined);
      assert.equal(resolved.default, undefined);
      assert.notEqual((resolved.adaptedPalette as typeof theme).primary, "#34383D");
      assert.deepEqual(uniformSmartBatchColors(resolved, styleId, surface), resolved);
    }
  }
});
test("project roles have equal weight, and different families keep different palettes", () => {
  const reordered = { primary: theme.neutral, secondary: theme.tertiary, tertiary: theme.primary, neutral: theme.secondary };
  for (const { id } of catalog.styles) assert.deepEqual(deriveStylePalette(theme, id), deriveStylePalette(reordered, id));
  assert.notDeepEqual(deriveStylePalette(theme, "mono-pastel"), deriveStylePalette(theme, "gradient-fill"));
  assert.notDeepEqual(deriveStylePalette(theme, "frosted"), deriveStylePalette(theme, "illustrative"));
  assert.notDeepEqual(deriveStylePalette(theme, "neon-tube", "light"), deriveStylePalette(theme, "neon-tube", "dark"));
  const smart = uniformSmartBatchColors({ mode: "smart", palette: theme }, "illustrative");
  assert.match(projectPaletteGuidance(smart)!, /NOT mandatory paint slots/);
  assert.match(projectPaletteGuidance(smart)!, /identity takes precedence/);
});
test("design-card parser preserves decisions and rejects malformed envelopes, not aesthetics", () => {
  const designCard = { recognition: "gear", layout: "center 12,12", openings: "central aperture", connections: "six equal teeth", stylePlan: "solid transparent hole", parts: [{ partId: "gear", meaning: "gear body" }] };
  const svg = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/></svg>';
  assert.deepEqual(parseProductionOutput(JSON.stringify({ designCard, svg })), { designCard, svg });
  assert.throws(() => parseProductionOutput(JSON.stringify({ svg })));
});

test("reviewed references and production contracts no longer prescribe opposite rendering", () => {
  assert.match(productionStyleContract("sharp"), /retain true circular apertures/);
  assert.match(productionStyleContract("angular"), /Retain curves and circular apertures/);
  assert.match(productionStyleContract("filled-duotone"), /lighter dominant body and darker compact/);
  assert.match(productionStyleContract("broken-outline"), /1.5-unit.*library Broken/);
  for (const id of ["neon-tube", "dual-neon"]) {
    const prompt = productionAuthoringPrompt(id, {});
    assert.match(prompt, /feGaussianBlur/);
    assert.match(prompt, /halo behind/);
    assert.doesNotMatch(prompt, /NO glow|No glow|alone gets a restrained halo/);
  }
});

test("illustrative uses flat structural depth, not lighting or gradients", () => {
  const contract = productionStyleContract("illustrative");
  assert.match(contract, /restrained structural depth/);
  assert.match(contract, /one uniform opaque paint/);
  assert.match(contract, /front\/rear overlap/);
  assert.match(contract, /darker same-hue side or recessed region/);
  assert.match(contract, /No gradients, highlights, light-source simulation/);
  assert.match(contract, /individually readable/);
  const prompt = productionAuthoringPrompt("illustrative", {});
  assert.match(prompt, /FLAT STRUCTURAL DEPTH/);
  assert.match(prompt, /no gradient\/filter resources/);
  assert.doesNotMatch(prompt, /ILLUSTRATED FORM SHADING|consistent upper-left light|same-hue SVG gradients|gentle same-hue gradients|lit area\/form-shadow boundary/);
  assert.match(productionStyleContract("semantic"), /No outlines, gradients, fake facets or shading/);
  for (const id of ["semantic", "palette", "regular", "mono-pastel", "clay", "plastic", "gradient-fill", "neon-tube"]) {
    assert.doesNotMatch(productionAuthoringPrompt(id, {}), /FLAT STRUCTURAL DEPTH/);
  }
});
