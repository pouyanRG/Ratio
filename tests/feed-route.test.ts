import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

import { GET as getFeed } from "@/app/api/feed/route";

const videos = Array.from({ length: 21 }, (_, index) => {
  const sequence = 21 - index;
  return {
    id: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    type: "reel",
    user_id: "user-1",
    created_at: new Date(Date.UTC(2026, 0, sequence)).toISOString(),
    duration_seconds: 12,
    views_count: sequence,
    thumbnail_url: `https://utfs.io/f/thumb-${sequence}`,
    caption: `caption-${sequence}`,
    profiles: {
      username: "creator",
      display_name: "Creator",
      avatar_url: null,
    },
  };
});

describe("feed route", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns a cursor page with persistent UploadThing thumbnail URLs", async () => {
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      or: vi.fn(() => query),
      order: vi.fn(() => query),
      limit: vi.fn().mockResolvedValue({ data: videos, error: null }),
    };
    mocks.createClient.mockResolvedValue({ from: vi.fn(() => query) });

    const response = await getFeed(new Request("https://ratio.example/api/feed?type=reel"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.videos).toHaveLength(20);
    expect(body.videos[0].thumbnailUrl).toBe("https://utfs.io/f/thumb-21");
    expect(body.videos[0].creator.username).toBe("creator");
    expect(body.videos[0]).not.toHaveProperty("storage_key");
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(body.nextCursor).toBeTruthy();
  });

  it("rejects invalid cursor and type input", async () => {
    const invalidCursor = await getFeed(
      new Request("https://ratio.example/api/feed?cursor=not-base64-json")
    );
    const invalidType = await getFeed(new Request("https://ratio.example/api/feed?type=story"));
    expect(invalidCursor.status).toBe(400);
    expect(invalidType.status).toBe(400);
  });
});