export type LatestVariantEditRevision = {
  id: string;
  status: string;
  error_code: string | null;
  error_message: string | null;
};

export function latestVariantEditFailure(
  revision: LatestVariantEditRevision | null | undefined,
) {
  const userResolvedCodes = new Set([
    "VARIANT_EDIT_DISCARDED",
    "RESTORED_DURING_EDIT",
  ]);
  if (
    !revision ||
    revision.status !== "failed" ||
    (revision.error_code && userResolvedCodes.has(revision.error_code))
  )
    return null;

  return {
    id: revision.id,
    errorCode: revision.error_code,
    message: revision.error_message,
  };
}
