import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FORM_FIRST_CARD, styleAuthoringRules } from './style-authoring';
import { illustrativeDesignPlanSchema } from './illustrative-structured-svg';

test('every catalog style has explicit family-specific authoring rules', () => {
  const catalog = JSON.parse(readFileSync(new URL('../../../../../../docs/design/svg-style-prompts-v2.json', import.meta.url),'utf8'));
  assert.equal(catalog.styles.length,46);
  for (const style of catalog.styles) assert.ok(styleAuthoringRules(style.id).includes(style.id));
  assert.throws(()=>styleAuthoringRules('unknown'));
});
test('family rules retain pixels, hand drawing, materials and semantic cutouts', () => {
  assert.match(styleAuthoringRules('pixel-solid'), /integer axis-aligned/);
  assert.match(styleAuthoringRules('doodle'), /Do not force mechanically mirrored/);
  assert.match(styleAuthoringRules('cutout'), /true transparent openings/);
  assert.match(styleAuthoringRules('three-level'), /alpha accumulation/);
  assert.match(styleAuthoringRules('clay'), /distinct highlight\/shadow rules/);
  assert.match(styleAuthoringRules('neon-tube'), /halo behind an unfiltered foreground/);
  assert.doesNotMatch(styleAuthoringRules('neon-tube'), /NO glow/);
  for (const id of ['sharp', 'angular', 'grid-based']) assert.match(styleAuthoringRules(id), /retain true circles/);
  assert.match(FORM_FIRST_CARD,/not a quota or cap/);
});
test('simple illustrative subjects need no invented attachments or five features', () => {
  const plan = {chosenObject:'plus',silhouette:'two equal crossing bars',diagnosticFeatures:['orthogonal arms'],assemblyRelations:[]};
  assert.deepEqual(illustrativeDesignPlanSchema.parse(plan),plan);
});

test('pixel wireframe uses painted-cell alignment without imposing outline rules on pixel solids', () => {
  const outline = styleAuthoringRules('pixel-outline');
  assert.match(outline, /n\+0\.5 yield integer painted edges/);
  assert.match(outline, /stroke-width=1/);
  assert.match(outline, /never attach a solid 3x3 or 4x3 block/);
  assert.match(outline, /at least TWO units apart/);
  assert.match(outline, /Do not set shape-rendering=crispEdges/);
  assert.match(outline, /Keep necessary inner seams/);
  assert.match(outline, /A naturally simple symbol needs no invented marks/);
  assert.doesNotMatch(styleAuthoringRules('pixel-solid'), /PIXEL WIREFRAME CONSTRUCTION/);
  assert.doesNotMatch(styleAuthoringRules('pixel-color'), /PIXEL WIREFRAME CONSTRUCTION/);
});

test('emission retains part breadth and isometric retains upright faces and real connecting walls', () => {
  for (const style of ['neon-tube', 'dual-neon']) {
    assert.match(styleAuthoringRules(style), /A centerline ray is not the outline/);
    assert.match(styleAuthoringRules(style), /genuinely thin rods may remain single lines/);
    assert.match(styleAuthoringRules(style), /each visible line IS one tube centerline/);
  }
  assert.doesNotMatch(styleAuthoringRules('soft-glow'), /TUBE PERIMETER CONSTRUCTION/);
  const iso = styleAuthoringRules('isometric');
  assert.match(iso, /upright face occupies x\/z, not x\/y/);
  assert.match(iso, /connecting each exposed front edge/);
  assert.match(iso, /prefer evenodd holes/);
});
