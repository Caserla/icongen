import assert from "node:assert/strict";
import test from "node:test";
import {
  generationSubjectDraftReducer,
  initialGenerationSubjectDrafts,
} from "./generation-subject-drafts";

test("keeps each subject description and background settings together", () => {
  let state = generationSubjectDraftReducer(initialGenerationSubjectDrafts, {
    type: "add",
    maxSubjects: 20,
  });
  state = generationSubjectDraftReducer(state, {
    type: "update-input",
    index: 1,
    value: "Second icon",
  });
  state = generationSubjectDraftReducer(state, {
    type: "set-background-mode",
    index: 1,
    value: "gradient",
  });
  state = generationSubjectDraftReducer(state, {
    type: "set-background-container",
    index: 1,
    value: "circle",
  });
  state = generationSubjectDraftReducer(state, {
    type: "set-background-corner-radius",
    index: 1,
    value: 30,
  });

  assert.deepEqual(state[1], {
    input: "Second icon",
    backgroundMode: "gradient",
    backgroundContainer: "circle",
    backgroundCornerRadius: 30,
  });
});

test("removing a subject cannot desynchronize its background settings", () => {
  let state = generationSubjectDraftReducer(initialGenerationSubjectDrafts, {
    type: "add",
    maxSubjects: 20,
  });
  state = generationSubjectDraftReducer(state, {
    type: "set-background-container",
    index: 1,
    value: "square",
  });
  state = generationSubjectDraftReducer(state, { type: "remove", index: 0 });

  assert.equal(state.length, 1);
  assert.equal(state[0]?.backgroundContainer, "square");
});
