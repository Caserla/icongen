import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { linearBoldPrompt } from "./linear-bold-authoring";
import { productionAuthoringPrompt } from "./production-authoring";

test("coincident open-edge masks leave a fractional-scale seam; overrun removes it", async () => {
  const fixture = (end: number) => `<svg viewBox="0 0 24 24"><defs><mask id="opening" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24"><rect width="24" height="24" fill="white"/><path d="M9.5 ${end}V14.5Q9.5 14 10 14H14Q14.5 14 14.5 14.5V${end}Z" fill="black"/></mask></defs><rect x="3.75" y="8.75" width="16.5" height="13" fill="#202020" mask="url(#opening)"/></svg>`;
  for (const size of [24, 48, 120]) {
    const alphaAtBottom = async (end: number) => {
      const { data, info } = await sharp(Buffer.from(fixture(end))).resize(size, size).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      return data[(Math.floor(21.75 * size / 24) * info.width + Math.floor(size / 2)) * 4 + 3];
    };
    assert.ok(await alphaAtBottom(21.75) > 0, `reproduce seam at ${size}`);
    assert.equal(await alphaAtBottom(24), 0, `open edge at ${size}`);
  }
});
test("both specialized and general authoring receive the open-edge construction rule", () => {
  for (const prompt of [linearBoldPrompt({ styleId: "state-pair", pair: true, theme: "light", subject: { name: "folder", description: "open folder" } }, "test"), productionAuthoringPrompt("filled-duotone", {})]) {
    assert.match(prompt, /OPEN-EDGE NEGATIVE SPACE/);
    assert.match(prompt, /PAST the outer painted edge/);
    assert.match(prompt, /Keep intentionally enclosed apertures enclosed/);
  }
});

test("shared construction reaches both branches without a subject-specific template", () => {
  for (const prompt of [linearBoldPrompt({ styleId: "state-pair", pair: true, theme: "light", subject: { name: "subject", description: "" } }, "test"), productionAuthoringPrompt("illustrative", {})]) {
    assert.match(prompt, /angular step 360\/n/);
    assert.match(prompt, /Equal units have equal LOCAL dimensions/);
    assert.match(prompt, /boundary sectors remain OPEN paths/);
    assert.match(prompt, /integer-preserving 90-degree rotations/);
    assert.match(prompt, /union's exposed contour/);
  }
  const pair = linearBoldPrompt({ styleId: "state-pair", pair: true, theme: "light", subject: { name: "subject", description: "" } }, "test");
  assert.match(pair, /Round joins on an outline do not round the corresponding solid path/);
  for (const style of ["gradient-fill", "radial", "multi-stop", "gradient-outline", "dual-neon"]) {
    const prompt = productionAuthoringPrompt(style, {});
    assert.match(prompt, /ONE untransformed rectangle/);
    assert.match(prompt, /Different real materials may retain separately planned paints/);
  }
  assert.match(productionAuthoringPrompt("isometric", {}), /0.866\(x-y\)/);
  assert.match(productionAuthoringPrompt("pixel-color", {}), /integer run-length pattern/);
});

test("rotated user-space gradients create seams; a single painted mask preserves world-space color", async () => {
  const gradient = '<linearGradient id="g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="24" y2="0"><stop stop-color="#245AC8"/><stop offset="1" stop-color="#D05396"/></linearGradient>';
  const body = '<rect x="2" y="8" width="20" height="8"/>';
  const unit = '<rect x="2" y="8" width="20" height="8" transform="rotate(90 12 12)"/>';
  const old = `<svg viewBox="0 0 24 24"><defs>${gradient}</defs><g fill="url(#g)">${body}${unit}</g></svg>`;
  const corrected = `<svg viewBox="0 0 24 24"><defs>${gradient}<mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24"><g fill="white">${body}${unit}</g></mask></defs><rect width="24" height="24" fill="url(#g)" mask="url(#m)"/></svg>`;
  for (const size of [24, 48, 160]) {
    const samples = async (svg: string) => {
      const { data } = await sharp(Buffer.from(svg)).resize(size, size).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const at = (x: number, y: number) => [...data.subarray((Math.floor(y * size / 24) * size + Math.floor(x * size / 24)) * 4, (Math.floor(y * size / 24) * size + Math.floor(x * size / 24)) * 4 + 3)];
      return { a: at(10, 4), b: at(10, 12) };
    };
    const before = await samples(old), after = await samples(corrected);
    assert.ok(Math.abs(before.a[0] - before.b[0]) > 35, `reproduced ${size}px transform seam`);
    assert.deepEqual(after.a, after.b, `same world X has same paint at ${size}px`);
  }
});

test("canvas masks on transformed local geometry crop the object; untransformed mask owner preserves aperture", async () => {
  const mask = '<defs><mask id="m" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="0" y="0" width="24" height="24"><rect width="24" height="24" fill="white"/><circle cx="12" cy="12" r="2" fill="black"/></mask></defs>';
  const old = `<svg viewBox="0 0 24 24">${mask}<rect x="-6" y="-6" width="12" height="12" transform="translate(12 12)" fill="#343A40" mask="url(#m)"/></svg>`;
  const fixed = `<svg viewBox="0 0 24 24">${mask}<g mask="url(#m)"><rect x="-6" y="-6" width="12" height="12" transform="translate(12 12)" fill="#343A40"/></g></svg>`;
  for (const size of [24, 48, 160]) {
    const alpha = async (svg: string, x: number, y: number) => {
      const { data } = await sharp(Buffer.from(svg)).resize(size, size).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      return data[(Math.floor(y * size / 24) * size + Math.floor(x * size / 24)) * 4 + 3];
    };
    assert.equal(await alpha(old, 8, 8), 0, `reproduce cropped quadrant ${size}`);
    assert.equal(await alpha(fixed, 8, 8), 255, `preserve body ${size}`);
    assert.equal(await alpha(fixed, 12, 12), 0, `preserve true opening ${size}`);
  }
  for (const style of ['isometric', 'extruded', 'gradient-fill', 'pixel-outline', 'neon-tube']) {
    const prompt = productionAuthoringPrompt(style, {});
    assert.match(prompt, /NOT an immutable root canvas/);
    assert.match(prompt, /UNTRANSFORMED parent group/);
    assert.match(prompt, /including negative bounds/);
  }
});

test("one-cell pixel strokes require half-grid centerlines, not fractional painted cells", async () => {
  const fixture = (offset: number) => `<svg viewBox="0 0 24 24"><path d="M${4 + offset} ${10 + offset}V${4 + offset}H${10 + offset}V${6 + offset}H${16 + offset}V${18 + offset}H${4 + offset}Z" fill="none" stroke="#343A40" stroke-width="1" stroke-linejoin="miter" stroke-linecap="square"/></svg>`;
  for (const size of [24, 48]) {
    const fractionalAlpha = async (offset: number) => {
      const data = await sharp(Buffer.from(fixture(offset))).resize(size, size).ensureAlpha().raw().toBuffer();
      let count = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 0 && data[i] < 255) count++;
      return count;
    };
    assert.equal(await fractionalAlpha(0.5), 0, `crisp painted cells ${size}px`);
    if (size === 24) assert.ok(await fractionalAlpha(0) > 0, 'integer centerline is half-pixel painted at native size');
  }
});

test("forcing crispEdges can erase a one-cell edge at 16px; normal coverage preserves it", async () => {
  const fixture = (crisp: boolean) => `<svg viewBox="0 0 24 24"${crisp ? ' shape-rendering="crispEdges"' : ''}><path d="M7.5 3.5H16.5V20.5H7.5Z" fill="none" stroke="#343A40" stroke-width="1" stroke-linejoin="miter"/></svg>`;
  const leftAlpha = async (crisp: boolean, size: number) => {
    const data = await sharp(Buffer.from(fixture(crisp))).resize(size, size).ensureAlpha().raw().toBuffer();
    return data[(Math.floor(12 * size / 24) * size + Math.floor(7.5 * size / 24)) * 4 + 3];
  };
  assert.equal(await leftAlpha(true, 16), 0, 'subpixel-width stroke disappears under forced snapping');
  assert.ok(await leftAlpha(false, 16) > 0, 'continuous fractional coverage at 16px');
  for (const size of [24, 48]) assert.equal(await leftAlpha(false, size), 255, `native grid remains crisp at ${size}`);
});
