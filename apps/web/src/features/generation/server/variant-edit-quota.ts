export const INCLUDED_DETAIL_EDITS_PER_VARIANT = 3;

export function remainingDetailEdits(usedSuccessfulEdits: number) {
  const used =
    Number.isSafeInteger(usedSuccessfulEdits) && usedSuccessfulEdits > 0
      ? usedSuccessfulEdits
      : 0;
  return Math.max(0, INCLUDED_DETAIL_EDITS_PER_VARIANT - used);
}
