import { timingSafeEqual } from "node:crypto";

export function healthcheckAuthorized(
  provided: string | null,
  expected: string | undefined,
) {
  if (!expected || expected.length < 24 || !provided) return false;
  const actual = Buffer.from(provided);
  const target = Buffer.from(expected);
  return actual.length === target.length && timingSafeEqual(actual, target);
}
