import test from "node:test";
import assert from "node:assert/strict";
import { uniformSmartBatchColors, colorApplicationPolicy, projectPaletteGuidance } from "./smart-project-colors";
test("ordinary monochrome replaces purple with neutral gray, preserves manual and special styles", () => {
  const input = {mode:'smart',batchColor:'#8855CC'};
  const result = uniformSmartBatchColors(input,'state-pair') as {batchColor:string};
  const channels = [1, 3, 5].map(i => parseInt(result.batchColor.slice(i, i + 2), 16));
  assert.ok(Math.max(...channels) - Math.min(...channels) <= 12);
  assert.deepEqual(uniformSmartBatchColors(result,'state-pair'),result);
  const neon = uniformSmartBatchColors(input,'neon-tube') as {batchColor?:string;locked:boolean;adaptedPalette:{primary:string}};
  assert.equal(neon.batchColor,undefined);
  assert.equal(neon.locked,false);
  assert.notEqual(neon.adaptedPalette.primary,'#8855CC');
  const dark = uniformSmartBatchColors(input,'regular','dark') as {batchColor:string};
  assert.ok(parseInt(dark.batchColor.slice(1,3),16) >= 176);
});
test("smart batch resolves the same exact color for every subject and retry", () => {
  const snapshot = { mode: "smart", locked: false, default: { mode: "solid", color: "#18abcf" } };
  const first = uniformSmartBatchColors(snapshot) as Record<string, unknown>;
  assert.notEqual(first.batchColor, "#18ABCF");
  assert.equal(first.locked, true);
  assert.deepEqual(uniformSmartBatchColors(JSON.parse(JSON.stringify(first))), first);
  assert.deepEqual(uniformSmartBatchColors(snapshot), first);
  assert.ok(colorApplicationPolicy(first).includes(String(first.batchColor)));
  assert.doesNotMatch(colorApplicationPolicy(first), /palette freely/);
  assert.match(projectPaletteGuidance(first)!, /only foreground hue/);
});

test("all four project colors and legacy primary locks are excluded", () => {
  const palette = {primary:'#18ABCF',secondary:'#AABBCC',tertiary:'#102030',neutral:'#505464'};
  for (const batchColor of Object.values(palette)) {
    const result = uniformSmartBatchColors({mode:'smart',palette,batchColor,default:{color:palette.primary}}) as {batchColor:string};
    assert.ok(!Object.values(palette).includes(result.batchColor));
    assert.deepEqual(uniformSmartBatchColors({mode:'smart',palette,batchColor:result.batchColor}), uniformSmartBatchColors({mode:'smart',palette,batchColor:result.batchColor}));
  }
});
test("stored batch color takes precedence over subsequent color defaults", () => {
  const result = uniformSmartBatchColors({mode:"smart",batchColor:"#123456",default:{color:"#ABCDEF"}}) as Record<string,unknown>;
  assert.deepEqual(result.default,{mode:"solid",color:"#123456"});
});
test("manual mode is unchanged, incomplete smart snapshots resolve deterministically", () => {
  const manual = {mode:"manual",default:{mode:"linear",color:"#112233",endColor:"#445566"}};
  assert.equal(uniformSmartBatchColors(manual),manual);
  assert.deepEqual(uniformSmartBatchColors({mode:"smart"}),uniformSmartBatchColors({mode:"smart"}));
});

test("multicolor and gradient styles share a role palette without solid-color locking", () => {
  const palette = {primary:"#58CC02",secondary:"#1CB0F6",tertiary:"#FF9600",neutral:"#4B5563"};
  for (const styleId of ["outline-duotone", "palette", "illustrative", "gradient-fill", "radial", "clay"]) {
    const result = uniformSmartBatchColors({mode:"smart",palette,batchColor:"#222222",locked:true,default:{mode:"solid",color:"#222222"}}, styleId) as Record<string, unknown>;
    assert.equal(result.locked, false);
    assert.equal(result.batchColor, undefined);
    assert.equal(result.default, undefined);
    assert.ok(result.adaptedPalette);
    assert.match(projectPaletteGuidance(result)!, /BATCH STYLE PALETTE/);
    assert.match(colorApplicationPolicy(result), /Never replace all paints with one foreground color/);
  }
});
