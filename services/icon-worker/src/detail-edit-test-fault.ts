export function shouldInjectDetailEditFailure(input: {
  editId: string;
  appEnvironment?: string;
  enabled?: string;
  targetEditId?: string;
}) {
  return (input.appEnvironment === "test" || input.appEnvironment === "preproduction") &&
    input.enabled === "1" &&
    input.targetEditId === input.editId;
}
