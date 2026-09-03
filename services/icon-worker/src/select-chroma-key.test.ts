import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { selectChromaKey } from "./select-chroma-key";

test("selects a key color far from green artwork", async () => {
  const greenIcon = await sharp({
    create: { width: 32, height: 32, channels: 4, background: "#00D060" },
  }).png().toBuffer();
  assert.notDeepEqual(await selectChromaKey(greenIcon), { red: 0, green: 255, blue: 0 });
});
