import assert from "node:assert/strict";
import test from "node:test";
import { parseGenerationWorkspaceSession } from "./generation-workspace-session";

test("migrates a paired session to one style without losing its project", () => {
  assert.deepEqual(parseGenerationWorkspaceSession(JSON.stringify({
    projectId: "project-1", projectName: "图标验收", mainStyleId: "linear", secondaryStyleId: "bold",
  })), {
    projectId: "project-1", projectName: "图标验收", mainStyleId: "linear",
  });
});

test("invalid styles fall back to linear without restoring a secondary style", () => {
  assert.deepEqual(parseGenerationWorkspaceSession(JSON.stringify({
    projectId: "project-1", projectName: "图标验收", mainStyleId: "unknown", secondaryStyleId: "linear",
  })), {
    projectId: "project-1", projectName: "图标验收", mainStyleId: "linear",
  });
  assert.equal(parseGenerationWorkspaceSession("{broken"), null);
});

test("round trips every single style and preserves project and draft association", () => {
  for (const mainStyleId of ["linear", "outline", "bold", "broken", "bulk", "twotone"]) {
    const saved = { projectId: "project-1", projectName: "保留的项目", mainStyleId };
    assert.deepEqual(parseGenerationWorkspaceSession(JSON.stringify(saved)), saved);
  }
});
