export function shouldInjectDetailEditFailure(input: {
  editId: string;
  nodeEnv?: string;
  enabled?: string;
  targetEditId?: string;
}) {
  return input.nodeEnv !== "production" &&
    input.enabled === "1" &&
    input.targetEditId === input.editId;
}
