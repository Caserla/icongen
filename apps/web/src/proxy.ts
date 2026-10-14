import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { checkMutationRequest } from "@/lib/security/mutation-request";
import {
  consumeRateLimit,
  requestIpIdentity,
  requestRateLimitIdentity,
} from "@/lib/security/rate-limit";

const protectedPrefixes = ["/library", "/create", "/icons", "/account", "/admin"];
const guestOnlyPrefixes = ["/auth/sign-in", "/auth/sign-up"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;
  if (process.env.EASY_ICON_LOCAL_MODE === "true") {
    const host = request.headers.get("host")?.split(":")[0];
    if (host !== "127.0.0.1" && host !== "localhost") return NextResponse.json({ error: {code:"LOCAL_ONLY",message:"Local mode is restricted to loopback."} }, {status:403});
    if (pathname.startsWith("/api/auth/")) return NextResponse.json({error:{code:"LOCAL_AUTH_DISABLED",message:"Local mode does not use account sign-in."}}, {status:410});
  }
  const requestCheck = checkMutationRequest({
    pathname,
    method: request.method,
    headers: request.headers,
    protocol: request.nextUrl.protocol,
  });
  if (!requestCheck.allowed)
    return NextResponse.json(
      { error: { code: requestCheck.code, message: requestCheck.message } },
      { status: requestCheck.status },
    );
  if (
    pathname.startsWith("/api/") &&
    !["GET", "HEAD", "OPTIONS"].includes(request.method)
  ) {
    const highRisk =
      pathname.startsWith("/api/auth/") ||
      pathname === "/api/account/credits/redeem";
    const rateLimit = consumeRateLimit({
      namespace: highRisk ? "sensitive-write" : "api-write",
      identity: highRisk
        ? requestIpIdentity(request.headers)
        : requestRateLimitIdentity(request.headers),
      limit: highRisk ? 10 : 60,
      windowMs: highRisk ? 10 * 60_000 : 60_000,
    });
    if (!rateLimit.allowed)
      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Too many requests. Try again later.",
          },
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds),
            "X-RateLimit-Limit": String(rateLimit.limit),
            "X-RateLimit-Remaining": "0",
          },
        },
      );
  }
  // API handlers perform their own authenticated authorization. Avoid a
  // second remote Supabase `getUser()` here after origin and rate-limit checks.
  if (pathname.startsWith("/api/")) return response;
  if (process.env.EASY_ICON_LOCAL_MODE === "true") {
    if (guestOnlyPrefixes.includes(pathname)) return NextResponse.redirect(new URL("/create", request.url));
    return response;
  }
  const isProtectedRoute = protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    if (!isProtectedRoute) return response;
    return redirectToSignIn(request, "auth_unavailable");
  }

  const hasAuthCookie = request.cookies
    .getAll()
    .some(
      ({ name, value }) =>
        name.startsWith("sb-") &&
        name.includes("-auth-token") &&
        value.length > 0,
    );
  if (!hasAuthCookie) {
    if (isProtectedRoute) return redirectToSignIn(request);
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet)
          request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet)
          response.cookies.set(name, value, options);
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  if (!data.user && isProtectedRoute) {
    return redirectToSignIn(request);
  }

  if (data.user && guestOnlyPrefixes.includes(pathname)) {
    return NextResponse.redirect(new URL("/create", request.url));
  }
  return response;
}

function redirectToSignIn(request: NextRequest, reason?: string) {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/auth/sign-in";
  loginUrl.search = "";
  loginUrl.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  if (reason) loginUrl.searchParams.set("reason", reason);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
