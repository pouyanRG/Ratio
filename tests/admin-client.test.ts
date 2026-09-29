import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));

vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));

import { createAdminClient } from "@/lib/supabase/admin";

describe("admin Supabase client", () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SECRET_KEY;
    vi.clearAllMocks();
  });

  it("does not send secret API keys as bearer JWTs", async () => {
    createAdminClient();
    const options = mocks.createClient.mock.calls[0][2] as {
      global: { fetch: typeof fetch };
    };

    await options.global.fetch("https://project.supabase.co/storage/v1/object/upload/sign", {
      headers: {
        apikey: "sb_secret_test",
        Authorization: "Bearer sb_secret_test",
      },
    });

    const requestHeaders = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(requestHeaders.get("apikey")).toBe("sb_secret_test");
    expect(requestHeaders.has("Authorization")).toBe(false);
  });
});