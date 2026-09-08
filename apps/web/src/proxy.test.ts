import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

test("redirects protected pages to sign-in when authentication is not configured", async () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  try {
    const response = await proxy(
      new NextRequest("http://localhost/create?from=hero"),
    );
    assert.equal(response.status, 307);
    const location = new URL(response.headers.get("location")!);
    assert.equal(location.pathname, "/auth/sign-in");
    assert.equal(location.searchParams.get("next"), "/create?from=hero");
    assert.equal(location.searchParams.get("reason"), "auth_unavailable");
    const library = await proxy(new NextRequest("http://localhost/library?icon=essential-sample-1"));
    assert.equal(library.status, 307);
    assert.equal(new URL(library.headers.get("location")!).searchParams.get("next"), "/library?icon=essential-sample-1");
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined)
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
  }
});

test("keeps marketing and authentication pages public without authentication configuration", async () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  try {
    for (const path of ["/", "/pricing", "/auth/sign-in", "/auth/sign-up"]) {
      const response = await proxy(new NextRequest(`http://localhost${path}`));
      assert.equal(response.status, 200, path);
      assert.equal(response.headers.get("location"), null, path);
    }
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined)
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
  }
});

test("skips remote authentication for visitors without a session cookie", async () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://invalid.example";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

  try {
    const publicResponse = await proxy(new NextRequest("http://localhost/"));
    assert.equal(publicResponse.status, 200);

    const protectedResponse = await proxy(
      new NextRequest("http://localhost/icons"),
    );
    assert.equal(protectedResponse.status, 307);
    assert.equal(
      new URL(protectedResponse.headers.get("location")!).pathname,
      "/auth/sign-in",
    );
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined)
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
  }
});
