const SECRET_KEY = /(authorization|cookie|token|secret|api.?key|signed.?url|prompt|instruction)/i;
const BEARER = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;
const SIGNED_QUERY = /([?&](?:token|signature|sig|key)=)[^&\s]+/gi;

export function redactLogValue(value: unknown, key = "", depth = 0): unknown {
  if (SECRET_KEY.test(key)) return "[REDACTED]";
  if (depth > 4) return "[TRUNCATED]";
  if (typeof value === "string")
    return value.slice(0, 1000).replace(BEARER, "Bearer [REDACTED]").replace(SIGNED_QUERY, "$1[REDACTED]");
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redactLogValue(item, "", depth + 1));
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).slice(0, 50).map(([childKey, child]) => [childKey, redactLogValue(child, childKey, depth + 1)]));
  return value;
}
