export class IncompleteGenerationJobSnapshotError extends Error {
  readonly code = "INCOMPLETE_GENERATION_JOB_SNAPSHOT";

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "IncompleteGenerationJobSnapshotError";
  }
}
