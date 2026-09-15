import assert from "node:assert/strict";
import test from "node:test";
import {
  centeredViewportOffset,
  clampProgress,
  easedProgress,
  normalizePointer,
  sectionProgress,
  segmentProgress,
  shouldAnimateArtwork,
} from "./landing-motion";

test("clamps finite timeline values", () => {
  assert.equal(clampProgress(-2), 0);
  assert.equal(clampProgress(0.4), 0.4);
  assert.equal(clampProgress(5), 1);
  assert.equal(clampProgress(Number.NaN), 0);
});

test("maps a sticky scene from entry to exit", () => {
  assert.equal(sectionProgress(92, 2200, 1000), 0);
  assert.equal(sectionProgress(-554, 2200, 1000), 0.5);
  assert.equal(sectionProgress(-2108, 2200, 1000), 1);
});

test("breaks one scroll timeline into independent segments", () => {
  assert.equal(segmentProgress(0.2, 0.25, 0.5), 0);
  assert.equal(segmentProgress(0.375, 0.25, 0.5), 0.5);
  assert.equal(segmentProgress(0.8, 0.25, 0.5), 1);
  assert.equal(segmentProgress(0.5, 1, 1), 0);
});

test("eases without leaving the timeline bounds", () => {
  assert.equal(easedProgress(0), 0);
  assert.equal(easedProgress(0.5), 0.5);
  assert.equal(easedProgress(1), 1);
  assert.ok(easedProgress(0.25) < 0.25);
});

test("normalizes viewport and pointer offsets", () => {
  assert.equal(centeredViewportOffset(400, 200, 1000), 0);
  assert.equal(centeredViewportOffset(1500, 200, 1000), 1);
  assert.equal(normalizePointer(50, 0, 100), 0);
  assert.equal(normalizePointer(100, 0, 100), 1);
});

test("ambient motion runs only when it is safe and requested", () => {
  const visibleState = {
    visible: true,
    pageHidden: false,
    reducedMotion: false,
    paused: false,
  };
  assert.equal(shouldAnimateArtwork(visibleState), true);
  assert.equal(
    shouldAnimateArtwork({ ...visibleState, visible: false }),
    false,
  );
  assert.equal(
    shouldAnimateArtwork({ ...visibleState, pageHidden: true }),
    false,
  );
  assert.equal(
    shouldAnimateArtwork({ ...visibleState, reducedMotion: true }),
    false,
  );
  assert.equal(shouldAnimateArtwork({ ...visibleState, paused: true }), false);
});
