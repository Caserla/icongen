const sensitiveKey =
  /(?:authorization|cookie|token|secret|password|api[-_]?key|prompt|instruction|email|signed[-_]?url)/i;

function redactText(value: string) {
  return value
    .slice(0, 1000)
    .replace(/Bearer\s+[^\s,;]+/gi, "Bearer [REDACTED]")
    .replace(
      /(["'](?:prompt|instruction|authorization|cookie|token|secret|password|api[-_]?key)["']\s*:\s*)["'][\s\S]*?["']/gi,
      '$1"[REDACTED]"',
    )
    .replace(
      /((?:prompt|instruction|authorization|cookie|token|secret|password|api[-_]?key)\s*[=:]\s*)[^,;&\s}\]]+/gi,
      "$1[REDACTED]",
    )
    .replace(/([?&](?:token|signature|sig|key)=)[^&#\s]+/gi, "$1[REDACTED]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]")
    .replace(/(?:sk|pk|rk)_[A-Za-z0-9_-]{12,}/g, "[REDACTED_KEY]");
}

export function redactServerLogValue(
  value: unknown,
  key = "",
  depth = 0,
): unknown {
  if (sensitiveKey.test(key)) return "[REDACTED]";
  if (depth > 4) return "[TRUNCATED]";
  if (value instanceof Error) {
    return { name: value.name, message: redactText(value.message) };
  }
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value))
    return value
      .slice(0, 20)
      .map((item) => redactServerLogValue(item, "", depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 50)
        .map(([entryKey, entryValue]) => [
          entryKey,
          redactServerLogValue(entryValue, entryKey, depth + 1),
        ]),
    );
  }
  return value;
}
