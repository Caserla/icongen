const PUBLIC_ERROR_MESSAGES = {
  generation: "Image generation could not be completed. Please try again.",
  edit: "The detail adjustment could not be completed. Please try again.",
  dispatch: "The processing worker could not be started. Please try again.",
} as const;

/** Provider errors may echo prompts, credentials, signed URLs, or local paths. */
export function publicErrorMessage(kind: keyof typeof PUBLIC_ERROR_MESSAGES) {
  return PUBLIC_ERROR_MESSAGES[kind];
}
