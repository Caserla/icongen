import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { SharpImageQualityGate } from "./sharp-image-quality-gate";

test("warns about a dark exterior app-icon backdrop without rejecting the asset", async () => {
  const source = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: "#101216" } }).png().toBuffer();
  const warnings = await new SharpImageQualityGate().inspect({ bytes: source, purpose: "app-icon" });
  assert.ok(warnings.some((warning) => warning.code === "APP_ICON_DARK_OUTER_CORNERS"));
});

test("accepts a bright full-canvas app-icon background", async () => {
  const source = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: "#FFFDF7" } }).png().toBuffer();
  const warnings = await new SharpImageQualityGate().inspect({ bytes: source, purpose: "app-icon" });
  assert.deepEqual(warnings, []);
});
