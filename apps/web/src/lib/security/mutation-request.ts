export const MAX_API_BODY_BYTES = 1024 * 1024;

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export type MutationRequestCheck =
  | { allowed: true }
  | { allowed: false; status: 403 | 413 | 415; code: string; message: string };

export function checkMutationRequest(input: {
  pathname: string;
  method: string;
  headers: Headers;
  protocol: string;
}): MutationRequestCheck {
  if (
    !input.pathname.startsWith("/api/") ||
    SAFE_METHODS.has(input.method)
  ) return { allowed: true };

  const origin = input.headers.get("origin");
  const fetchSite = input.headers.get("sec-fetch-site");
  if (!origin || (fetchSite && fetchSite !== "same-origin"))
    return { allowed: false, status: 403, code: "INVALID_REQUEST_ORIGIN", message: "The request origin is not allowed." };

  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return { allowed: false, status: 403, code: "INVALID_REQUEST_ORIGIN", message: "The request origin is not allowed." };
  }
  const host = input.headers.get("x-forwarded-host") ?? input.headers.get("host");
  const protocol = input.headers.get("x-forwarded-proto") ?? input.protocol.replace(":", "");
  if (!host || originUrl.host !== host || originUrl.protocol !== `${protocol}:`)
    return { allowed: false, status: 403, code: "INVALID_REQUEST_ORIGIN", message: "The request origin is not allowed." };

  const rawLength = input.headers.get("content-length") ?? "0";
  const declaredLength = Number(rawLength);
  if (!/^\d+$/.test(rawLength) || !Number.isSafeInteger(declaredLength) || declaredLength > MAX_API_BODY_BYTES)
    return { allowed: false, status: 413, code: "REQUEST_TOO_LARGE", message: "The request body is too large." };
  if (declaredLength > 0 && !input.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
    return { allowed: false, status: 415, code: "UNSUPPORTED_CONTENT_TYPE", message: "Use application/json for this request." };
  return { allowed: true };
}
