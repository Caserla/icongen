import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import production from "../../../../../docs/design/svg-style-production-v3.json";

type Style = {
  id: string;
  previewStylePrompt: string;
  productionStylePrompt: string;
  stylePrompt: string;
  promptTemplate: string;
};

const catalog = JSON.parse(readFileSync(new URL("../../../../../docs/design/svg-style-prompts-v2.json", import.meta.url), "utf8")) as {
  version: string;
  styles: Style[];
};

test("all 46 production styles use the clean production contract, not historical preview subjects", () => {
  assert.equal(catalog.version, production.version);
  assert.equal(catalog.styles.length, 46);
  for (const style of catalog.styles) {
    assert.ok(style.previewStylePrompt.trim(), `${style.id} is missing its preview prompt`);
    assert.equal(style.stylePrompt, style.previewStylePrompt);
    assert.match(style.promptTemplate, /SELECTED_PRODUCTION_STYLE/);
    assert.ok(style.promptTemplate.includes(style.productionStylePrompt));
    assert.equal(style.productionStylePrompt, production.styles[style.id as keyof typeof production.styles]);
    assert.doesNotMatch(style.promptTemplate, /AUTHORITATIVE_ATLAS_STYLE:|AUTHORITATIVE_PREVIEW_STYLE:|strawberry|calyx/i);
  }
});

test("known visible-preview contracts are preserved exactly", () => {
  const neon = catalog.styles.find((style) => style.id === "neon-tube");
  const clay = catalog.styles.find((style) => style.id === "clay");
  assert.match(neon?.previewStylePrompt ?? "", /No glow, blur, halo or shadow/i);
  assert.match(clay?.previewStylePrompt ?? "", /broad smooth diffuse shading/i);
});

test("single-icon prompts do not inherit atlas board instructions or fixed subjects", () => {
  for (const style of catalog.styles) {
    assert.doesNotMatch(style.previewStylePrompt, /24-icon|6 columns|4 rows|ROW 1|No labels/i);
    assert.doesNotMatch(style.promptTemplate, /generate exactly one standalone editable SVG strawberry/i);
  }
});

test("all 46 substyles have distinct production-strength visual contracts", () => {
  const contracts = new Set<string>();
  for (const style of catalog.styles) {
    assert.ok(style.productionStylePrompt.trim().length >= 70, `${style.id} production contract is too weak`);
    contracts.add(style.productionStylePrompt.trim().toLowerCase());
  }
  assert.equal(contracts.size, 46, "Every substyle must keep a distinct production contract");
});
