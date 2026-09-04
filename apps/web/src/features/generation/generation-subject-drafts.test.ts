import assert from "node:assert/strict";
import test from "node:test";
import {
  generationSubjectDraftReducer,
  initialGenerationSubjectDrafts,
} from "./generation-subject-drafts";
import { createGenerationJobSchema, DESIGN_SETTINGS_VERSION } from "@icongen/shared";

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
    type: "set-background-color",
    index: 1,
    value: {
      mode: "gradient",
      colors: ["#112233", "#AABBCC"],
      direction: "left-to-right",
    },
  });
  state = generationSubjectDraftReducer(state, {
    type: "set-background-corner-radius",
    index: 1,
    value: 30,
  });

  assert.deepEqual(state[1], {
    input: "Second icon",
    backgroundMode: "gradient",
    backgroundColor: {
      mode: "gradient",
      colors: ["#112233", "#AABBCC"],
      direction: "left-to-right",
    },
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

test("interaction jobs accept a different background override for every subject", () => {
  const result = createGenerationJobSchema.safeParse({
    idempotencyKey: "2a4c2034-b3fe-4744-82d5-b099f4cc55a1",
    settingsVersion: DESIGN_SETTINGS_VERSION,
    purpose: "interaction",
    subjects: [
      {
        clientId: "subject-1",
        name: "Search",
        description: "Search",
        backgroundOverride: { enabled: false },
      },
      {
        clientId: "subject-2",
        name: "Profile",
        description: "Profile",
        backgroundOverride: {
          enabled: true,
          container: "circle",
          color: { mode: "solid", color: "#FFFFFF" },
          autoColor: true,
        },
      },
    ],
    subjectColor: { mode: "solid", color: "#61666E" },
    background: { enabled: false },
    style: {
      preset: "minimal-logo",
      graphicStructure: "linear",
      subjectSizePercent: 70,
      linearStrokeWidthPercent: 3.5,
      strokeWeight: "regular",
      cornerStyle: "balanced",
      detailLevel: "standard",
    },
    sizes: [64],
  });

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.deepEqual(result.data.subjects[0]?.backgroundOverride, {
    enabled: false,
  });
  assert.equal(
    result.data.subjects[1]?.backgroundOverride?.enabled,
    true,
  );
});
