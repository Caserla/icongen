import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { SharpImageQualityGate } from "./sharp-image-quality-gate";

const flatContract = { mode: "solid" as const, color: "#FFD85A", profile: "flat" as const, colorTolerance: 28, targetTolerance: 96, minBorderCoverage: 0.72, minCanvasCoverage: 0.28 };
const materialContract = { mode: "solid" as const, color: "#7C5CE5", profile: "material" as const, colorTolerance: 34, targetTolerance: 110, minBorderCoverage: 0.66, minCanvasCoverage: 0.20 };
const neonContract = { mode: "gradient" as const, colors: ["#090B2E", "#24104F"] as [string, string], profile: "neon" as const };

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

test("rejects a painted transparency checkerboard", async () => {
  const tile = 128;
  const source = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: "#f3f3f3" } })
    .composite(Array.from({ length: 64 }, (_, index) => {
      const x = index % 8;
      const y = Math.floor(index / 8);
      return { input: { create: { width: tile, height: tile, channels: 3 as const, background: (x + y) % 2 === 0 ? "#d8d8d8" : "#f5f5f5" } }, left: x * tile, top: y * tile };
    }))
    .png()
    .toBuffer();
  const warnings = await new SharpImageQualityGate().inspect({ bytes: source, purpose: "app-icon" });
  assert.ok(warnings.some((warning) => warning.code === "FAKE_TRANSPARENCY_CHECKERBOARD"));
});

test("accepts a uniform full-bleed flat-playful background with a centered subject", async () => {
  const source = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: "#FFD85A" } })
    .composite([{ input: { create: { width: 420, height: 520, channels: 3, background: "#39C98A" } }, left: 302, top: 252 }])
    .png()
    .toBuffer();
  const warnings = await new SharpImageQualityGate().inspect({ bytes: source, purpose: "app-icon", stylePreset: "flat-playful", backgroundContract: flatContract });
  assert.ok(!warnings.some((warning) => warning.code === "NON_UNIFORM_SOLID_BACKGROUND"));
});

test("rejects a flat-playful background with painted mist along the border", async () => {
  const source = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: "#FFF9EE" } })
    .composite([{ input: { create: { width: 1024, height: 260, channels: 3, background: "#5B8DFF" } }, left: 0, top: 240, blend: "over" }])
    .blur(48)
    .png()
    .toBuffer();
  const warnings = await new SharpImageQualityGate().inspect({ bytes: source, purpose: "app-icon", stylePreset: "flat-playful", backgroundContract: flatContract });
  assert.ok(warnings.some((warning) => warning.code === "NON_UNIFORM_SOLID_BACKGROUND"));
});

test("rejects a flat-playful icon with an inset colored background panel", async () => {
  const source = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: "#FFF9EE" } })
    .composite([{ input: { create: { width: 820, height: 820, channels: 3, background: "#4C7FF0" } }, left: 102, top: 102 }])
    .png()
    .toBuffer();
  const warnings = await new SharpImageQualityGate().inspect({ bytes: source, purpose: "app-icon", stylePreset: "flat-playful", backgroundContract: flatContract });
  assert.ok(warnings.some((warning) => warning.code === "NON_UNIFORM_SOLID_BACKGROUND"));
});

test("applies the uniform solid background gate to clay app icons", async () => {
  const source = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: "#F4EFE7" } })
    .composite([{ input: { create: { width: 1024, height: 300, channels: 3, background: "#FFD85A" } }, left: 0, top: 250 }])
    .blur(36)
    .png()
    .toBuffer();
  const warnings = await new SharpImageQualityGate().inspect({ bytes: source, purpose: "app-icon", stylePreset: "clay-3d", backgroundContract: materialContract });
  assert.ok(warnings.some((warning) => warning.code === "NON_UNIFORM_SOLID_BACKGROUND"));
});

test("does not apply the uniform solid background gate to neon gradients", async () => {
  const source = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: "#090B2E" } })
    .composite([{ input: { create: { width: 1024, height: 512, channels: 3, background: "#24104F" } }, left: 0, top: 512 }])
    .blur(80)
    .png()
    .toBuffer();
  const warnings = await new SharpImageQualityGate().inspect({ bytes: source, purpose: "app-icon", stylePreset: "neon", backgroundContract: neonContract });
  assert.ok(!warnings.some((warning) => warning.code === "NON_UNIFORM_SOLID_BACKGROUND"));
  assert.ok(!warnings.some((warning) => warning.code === "APP_ICON_DARK_OUTER_CORNERS"));
});

test("does not duplicate dark-corner warnings when a solid background contract is present", async () => {
  const source = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: "#243B6B" } }).png().toBuffer();
  const warnings = await new SharpImageQualityGate().inspect({
    bytes: source,
    purpose: "app-icon",
    stylePreset: "pixel-art",
    backgroundContract: { mode: "solid", color: "#243B6B", profile: "pixel", colorTolerance: 24, targetTolerance: 88, minBorderCoverage: 0.72, minCanvasCoverage: 0.24 },
  });
  assert.ok(!warnings.some((warning) => warning.code === "APP_ICON_DARK_OUTER_CORNERS"));
});
