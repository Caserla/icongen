type Bucket = { count: number; resetAt: number };

const globalBuckets = globalThis as typeof globalThis & {
  __icongenRateLimitBuckets?: Map<string, Bucket>;
};
const buckets = (globalBuckets.__icongenRateLimitBuckets ??= new Map<
  string,
  Bucket
>());

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

export function consumeRateLimit(input: {
  namespace: string;
  identity: string;
  limit: number;
  windowMs: number;
  now?: number;
}): RateLimitResult {
  const now = input.now ?? Date.now();
  const key = `${input.namespace}:${input.identity}`;
  const current = buckets.get(key);
  const bucket =
    !current || current.resetAt <= now
      ? { count: 0, resetAt: now + input.windowMs }
      : current;
  bucket.count += 1;
  buckets.set(key, bucket);
  if (buckets.size > 10_000) {
    for (const [bucketKey, value] of buckets)
      if (value.resetAt <= now) buckets.delete(bucketKey);
  }
  return {
    allowed: bucket.count <= input.limit,
    limit: input.limit,
    remaining: Math.max(0, input.limit - bucket.count),
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

export function requestIpIdentity(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip") || "unknown";
}

export function requestRateLimitIdentity(headers: Headers) {
  const ip = requestIpIdentity(headers);
  const sessionHint = fastHash(headers.get("cookie") ?? "anonymous");
  return `${ip}:${sessionHint}`;
}

function fastHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function resetRateLimitsForTests() {
  buckets.clear();
}
