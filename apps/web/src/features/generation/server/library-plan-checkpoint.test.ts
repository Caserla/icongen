import test from "node:test";
import assert from "node:assert/strict";
import { createLibraryPlanCheckpoint, readLibraryPlanCheckpoint } from "./library-plan-checkpoint";
import { libraryPlanOutputShape, librarySubjectPlanSchema } from "./library-six-plan";

test("checkpoint signature, expiry and full input identity are mandatory", t => {
  const plan = librarySubjectPlanSchema.parse({ ...libraryPlanOutputShape, constructionFamily: "enclosure",
    parts: libraryPlanOutputShape.parts.map(p => ({ ...p, role: "body", joinKind: "none" })),
    constructions: libraryPlanOutputShape.constructions.map(c => ({ ...c, style: "linear" })),
  });
  const now = Date.now();
  const checkpoint = createLibraryPlanCheckpoint({ plan, calls: [], inputHash: "same" }, "server-key");
  assert.ok(readLibraryPlanCheckpoint(checkpoint, "same", "server-key"));
  assert.equal(readLibraryPlanCheckpoint(checkpoint, "changed", "server-key"), undefined);
  assert.equal(readLibraryPlanCheckpoint(checkpoint, "same", "rotated-key"), undefined);
  assert.equal(readLibraryPlanCheckpoint({ payload: "{", signature: "invalid" }, "same", "server-key"), undefined);
  t.mock.method(Date, "now", () => now + 24 * 60 * 60 * 1000 + 1000);
  assert.equal(readLibraryPlanCheckpoint(checkpoint, "same", "server-key"), undefined);
});
