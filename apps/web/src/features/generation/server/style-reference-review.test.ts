import { strict as assert } from "node:assert";
import { test } from "node:test";
import { parseStyleReferenceReview, STYLE_REFERENCE_REVIEW_PROMPT } from "./style-reference-review";

test("style review requires a scored visual verdict", () => {
  const value = parseStyleReferenceReview({ pass: false, score: 61, recognizedSubject: "abstract shape", recognizabilityScore: 30, structureScore: 45, styleScore: 72, matchedTraits: ["same palette"], issues: ["mixed thickness"], correction: "Use one optical thickness." });
  assert.equal(value.pass, false);
  assert.match(STYLE_REFERENCE_REVIEW_PROMPT, /without relying on a caption/);
  assert.match(STYLE_REFERENCE_REVIEW_PROMPT, /recognizabilityScore >= 88/);
  assert.match(STYLE_REFERENCE_REVIEW_PROMPT, /abstract blob/);
});

test("verbose reviewer evidence is bounded without losing the verdict", () => {
  const review = parseStyleReferenceReview({
    pass: true, score: 90, recognizedSubject: "apple", recognizabilityScore: 92,
    structureScore: 89, styleScore: 88,
    matchedTraits: Array.from({ length: 12 }, (_, index) => `trait ${index}`),
    issues: Array.from({ length: 10 }, (_, index) => `issue ${index}`), correction: "",
  });
  assert.equal(review.matchedTraits.length, 8);
  assert.equal(review.issues.length, 8);
});
