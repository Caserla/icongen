import test from "node:test";
import assert from "node:assert/strict";
import { libraryConstructionReference, selectConstructionDonor } from "./library-construction-reference";
import { libraryPlanningPrompt } from "./library-six-plan";

test("structural examples never select the requested catalogue object", async () => {
  assert.equal(selectConstructionDonor("enclosure", { name: "挂锁" })?.id, "video-audio-image-sample-2");
  assert.equal(selectConstructionDonor("elongated", { name: "开口扳手" })?.id, "stationery-sample-2");
  assert.equal(selectConstructionDonor("organic", { name: "leaf" })?.id, "animals-sample-2");
  assert.equal(selectConstructionDonor("unknown", { name: "图标" }), null);
  const ref = await libraryConstructionReference("layered", { name: "背包" }, ["bulk", "twotone"]);
  assert.equal(ref?.examples.length, 2);
  assert.ok(ref?.examples.every(example => example.sha256.length === 64 && example.dataUrl.startsWith("data:image/png")));
  assert.ok(ref?.examples[0].geometryExample?.includes("<svg"));
});
test("planning asks for generic construction decisions, not target-specific recipes", () => {
  const prompt = libraryPlanningPrompt(["linear", "bold"]);
  assert.match(prompt, /constructionFamily/); assert.match(prompt, /Filled-path corners/);
  assert.doesNotMatch(prompt, /相机|钥匙|camera|keyhole/i);
});
test("Outline examples expose editable centerlines rather than expanded geometry", async () => {
  const ref = await libraryConstructionReference("enclosure", { name: "收音机" }, ["outline"]);
  assert.equal(ref?.examples[0].style, "outline");
  assert.equal(ref?.examples[0].sourceStyle, "linear");
  assert.match(ref?.examples[0].geometryExample ?? "", /stroke=/);
});
