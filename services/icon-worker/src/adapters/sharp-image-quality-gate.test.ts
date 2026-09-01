import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { SharpImageQualityGate } from "./sharp-image-quality-gate";

const flatContract = { mode: "solid" as const, color: "#FFD85A", profile: "flat" as const, colorTolerance: 28, targetTolerance: 96, minBorderCoverage: 0.72, minCanvasCoverage: 0.28 };
const materialContract = { mode: "solid" as const, color: "#7C5CE5", profile: "material" as const, colorTolerance: 34, targetTolerance: 110, minBorderCoverage: 0.66, minCanvasCoverage: 0.20 };
const neonContract = { mode: "gradient" as const, colors: ["#090B2E", "#24104F"] as [string, string], profile: "neon" as const };
const consistencyContract = { enabled: true, linear: false, targetScale: 0.7, minScale: 0.66, maxScale: 0.75, maxAbsoluteCenterOffset: 0.025, minLineWeight: 0.025, maxLineWeight: 0.045, maxScaleDelta: 0.12, maxCenterDelta: 0.04, maxLineWeightDelta: 0.2 };

async function transparentSquare(left: number, top: number, size: number) {
  return sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: { create: { width: size, height: size, channels: 4, background: "#2563EB" } }, left, top }])
    .png()
    .toBuffer();
}

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

test("rejects a generated asset that reproduces the complete style reference board", async () => {
  const reference = await sharp({
    create: { width: 1536, height: 1024, channels: 3, background: "#fffdf7" },
  })
    .composite([
      { input: { create: { width: 320, height: 320, channels: 3, background: "#20bfae" } }, left: 120, top: 100 },
      { input: { create: { width: 320, height: 320, channels: 3, background: "#ffb800" } }, left: 608, top: 100 },
      { input: { create: { width: 320, height: 320, channels: 3, background: "#8b6fd6" } }, left: 1096, top: 100 },
      { input: { create: { width: 320, height: 320, channels: 3, background: "#2f80ed" } }, left: 120, top: 604 },
      { input: { create: { width: 320, height: 320, channels: 3, background: "#ff4f4f" } }, left: 608, top: 604 },
      { input: { create: { width: 320, height: 320, channels: 3, background: "#65c96b" } }, left: 1096, top: 604 },
    ])
    .png()
    .toBuffer();
  const warnings = await new SharpImageQualityGate().inspect({
    bytes: reference,
    referenceImageBytes: reference,
    purpose: "app-icon",
  });
  assert.ok(warnings.some((warning) => warning.code === "REFERENCE_BOARD_REPRODUCTION"));
  assert.ok(warnings.some((warning) => warning.code === "SOURCE_NOT_SQUARE"));
});

test("allows a new square icon that only shares the reference palette", async () => {
  const reference = await sharp({
    create: { width: 1536, height: 1024, channels: 3, background: "#fffdf7" },
  }).png().toBuffer();
  const candidate = await sharp({
    create: { width: 1024, height: 1024, channels: 3, background: "#20bfae" },
  })
    .composite([{ input: { create: { width: 360, height: 360, channels: 3, background: "#ffb800" } }, left: 332, top: 332 }])
    .png()
    .toBuffer();
  const warnings = await new SharpImageQualityGate().inspect({
    bytes: candidate,
    referenceImageBytes: reference,
    purpose: "app-icon",
  });
  assert.ok(!warnings.some((warning) => warning.code === "REFERENCE_BOARD_REPRODUCTION"));
});

test("accepts a transparent subject matching the icon-set reference geometry", async () => {
  const reference = await transparentSquare(154, 154, 716);
  const candidate = await transparentSquare(159, 159, 706);
  const warnings = await new SharpImageQualityGate().inspect({ bytes: candidate, consistencyReferenceBytes: reference, consistencyContract });
  assert.ok(!warnings.some((warning) => warning.code === "SUBJECT_SCALE_INCONSISTENT"));
  assert.ok(!warnings.some((warning) => warning.code === "SUBJECT_ALIGNMENT_INCONSISTENT"));
});

test("rejects a transparent subject that is much smaller and off-center", async () => {
  const reference = await transparentSquare(154, 154, 716);
  const candidate = await transparentSquare(80, 80, 360);
  const warnings = await new SharpImageQualityGate().inspect({ bytes: candidate, consistencyReferenceBytes: reference, consistencyContract });
  assert.ok(warnings.some((warning) => warning.code === "SUBJECT_SCALE_INCONSISTENT"));
  assert.ok(warnings.some((warning) => warning.code === "SUBJECT_ALIGNMENT_INCONSISTENT"));
});

test("rejects an oversized and overly heavy retry even without a reference image", async () => {
  const source = await sharp(Buffer.from(`<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg"><path fill="none" stroke="#61666E" stroke-width="100" stroke-linejoin="round" d="M100 512 H900 M100 512 L420 210 M100 512 L420 814"/></svg>`)).png().toBuffer();
  const warnings = await new SharpImageQualityGate().inspect({ bytes: source, consistencyContract: { ...consistencyContract, linear: true } });
  assert.ok(warnings.some((warning) => warning.code === "SUBJECT_SCALE_INCONSISTENT"));
  assert.ok(warnings.some((warning) => warning.code === "LINE_WEIGHT_INCONSISTENT"));
});

test("rejects a visibly deformed silhouette for a symmetric semantic contract", async () => {
  const source = await sharp(Buffer.from(`<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg"><path fill="none" stroke="#61666E" stroke-width="60" stroke-linejoin="round" d="M512 150 L610 390 L890 410 L660 580 L760 860 L500 700 L250 850 L350 565 L135 390 L410 385 Z"/></svg>`)).png().toBuffer();
  const warnings = await new SharpImageQualityGate().inspect({
    bytes: source,
    geometryContract: { category: "symmetric-symbol", symmetry: "vertical", maxSymmetryError: 0.2 },
  });
  assert.ok(warnings.some((warning) => warning.code === "GEOMETRY_SYMMETRY_BROKEN"));
});

test("accepts a balanced silhouette for a symmetric semantic contract", async () => {
  const source = await sharp(Buffer.from(`<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg"><path fill="none" stroke="#61666E" stroke-width="60" stroke-linejoin="round" d="M512 150 L610 390 L870 410 L670 580 L735 840 L512 700 L289 840 L354 580 L154 410 L414 390 Z"/></svg>`)).png().toBuffer();
  const warnings = await new SharpImageQualityGate().inspect({
    bytes: source,
    geometryContract: { category: "symmetric-symbol", symmetry: "vertical", maxSymmetryError: 0.2 },
  });
  assert.ok(!warnings.some((warning) => warning.code === "GEOMETRY_SYMMETRY_BROKEN"));
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
