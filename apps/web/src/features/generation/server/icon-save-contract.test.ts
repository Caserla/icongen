import test from "node:test";
import assert from "node:assert/strict";
import { expandStatePairPlan, expandStylePairPlan, normalizeIconPlan, parsePersistedIconPlan } from "../icon-plan";
import { prepareIconSave } from "./icon-save-contract";
import { createHash } from "node:crypto";
const svg = '<svg viewBox="0 0 24 24"><path d="M2 2h20v20H2z" fill="#123456"/></svg>';
const source = { recognizable: true, intent: "explicit_subjects", referenceUse: "none", summary: "test", subjects: [{ name: "Home", description: "Home navigation" }] };
test("planned state pair survives create, serialize, save and reload without ID changes", () => {
  const planned = expandStatePairPlan(normalizeIconPlan(source));
  const saved = parsePersistedIconPlan(JSON.parse(JSON.stringify(planned)));
  const rows = prepareIconSave({ icons: planned.subjects.map(s => ({ subjectId: s.id, svg })) }, saved.subjects);
  const loaded = JSON.parse(JSON.stringify({ plan: saved, icons: Object.fromEntries(rows.map(row => [row.subject_id, row.svg])) }));
  assert.equal(rows.length, 2);
  assert.deepEqual(saved.subjects, planned.subjects);
  for (const subject of loaded.plan.subjects) assert.equal(loaded.icons[subject.id], svg);
});
test("legacy sequential IDs remain valid as a matched pair", () => {
  const p = expandStatePairPlan(normalizeIconPlan(source));
  const subjects = p.subjects.map((s,i) => ({ ...s, id: `icon-${i+1}` }));
  assert.equal(prepareIconSave({ icons: subjects.map(s => ({ subjectId: s.id, svg })) }, subjects).length, 2);
});
test("invalid second SVG rejects whole pair before storage", () => {
  const p = expandStatePairPlan(normalizeIconPlan(source));
  assert.throws(() => prepareIconSave({ icons: p.subjects.map((s,i) => ({ subjectId:s.id, svg:i ? '<script/>' : svg })) }, p.subjects));
  assert.throws(() => prepareIconSave({subjectId:p.subjects[0].id,svg},p.subjects));
});
test("duplicate subjects are rejected and fallback state pairs are preserved", () => {
  const p = expandStatePairPlan(normalizeIconPlan({...source,recognizable:false,intent:"unclear",subjects:[]}));
  assert.equal(parsePersistedIconPlan(p).subjects.length,40);
  assert.throws(() => parsePersistedIconPlan({...p,subjects:[p.subjects[0],p.subjects[0]]}));
});
test("ordinary icon ID survives persistence and save", () => {
  const p = parsePersistedIconPlan(normalizeIconPlan(source));
  assert.equal(prepareIconSave({subjectId:p.subjects[0].id,svg},p.subjects)[0].subject_id,p.subjects[0].id);
});
test("stored review is bound to the exact SVG hash, not merely a success flag", () => {
  const p = parsePersistedIconPlan(normalizeIconPlan(source));
  const generationContext = { version: "library-six-session-1", protocolHash: "a".repeat(64), reviewStatus: "pending", finalHashes: { linear: createHash("sha256").update(svg).digest("hex") } };
  const rows = prepareIconSave({ subjectId: p.subjects[0].id, svg, generationContext }, p.subjects);
  assert.equal(rows[0].generation_context?.reviewStatus, "pending");
  assert.throws(() => prepareIconSave({ subjectId: p.subjects[0].id, svg: svg.replace("123456", "234567"), generationContext }, p.subjects), /does not match/);
});
test("one semantic subject stores all six checked styles with Linear as its canvas image", () => {
  const subject = parsePersistedIconPlan(normalizeIconPlan(source)).subjects[0];
  const styles = ["linear", "outline", "bold", "broken", "bulk", "twotone"];
  const styleVariants = Object.fromEntries(styles.map(style => [style, svg]));
  const hash = createHash("sha256").update(svg).digest("hex");
  const generationContext = { version: "library-six-session-7", protocolHash: "a".repeat(64), reviewStatus: "model-reviewed", finalHashes: Object.fromEntries(styles.map(style => [style, hash])) };
  const rows = prepareIconSave({ subjectId: subject.id, svg, generationContext, styleVariants }, [subject]);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].style_variants, styleVariants);
  assert.throws(() => prepareIconSave({ subjectId: subject.id, svg, generationContext, styleVariants: { ...styleVariants, bulk: svg.replace("123456", "234567") } }, [subject]), /does not match bulk/);
  assert.throws(() => prepareIconSave({ subjectId: subject.id, svg, generationContext, styleVariants: { linear: svg } }, [subject]), /Incomplete six-style/);
});
test("main and secondary styles remain separate saved icons in the same group", () => {
  const planned = parsePersistedIconPlan(expandStylePairPlan(normalizeIconPlan(source)));
  const main = prepareIconSave({ subjectId: planned.subjects[0].id, svg }, planned.subjects);
  const secondary = prepareIconSave({ subjectId: planned.subjects[1].id, svg }, planned.subjects);
  assert.equal(main.length, 1);
  assert.equal(secondary.length, 1);
  assert.notEqual(main[0].subject_id, secondary[0].subject_id);
  assert.equal(planned.subjects[0].name, planned.subjects[1].name);
  assert.equal(prepareIconSave({ icons: planned.subjects.map(s => ({ subjectId: s.id, svg })) }, planned.subjects).length, 2);
  assert.throws(() => prepareIconSave({ icons: planned.subjects.map((s, i) => ({ subjectId: s.id, svg: i ? "<script/>" : svg })) }, planned.subjects));
  const unrelated = { ...planned.subjects[1], id: "different-secondary" };
  assert.throws(() => prepareIconSave({ icons: [planned.subjects[0], unrelated].map(s => ({ subjectId: s.id, svg })) }, [planned.subjects[0], unrelated]));
});
