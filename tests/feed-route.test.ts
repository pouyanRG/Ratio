import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  thumbnailStorageKey: vi.fn((id: string) => `videos/${id}/thumb.jpg`),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/storage", () => ({
  VIDEO_BUCKET: "videos",
  thumbnailStorageKey: mocks.thumbnailStorageKey,
}));

import { GET as getFeed } from "@/app/api/feed/route";

const videos = Array.from({ length: 21 }, (_, index) => {
  const sequence = 21 - index;
  return {
    id: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    type: "reel",
    created_at: new Date(Date.UTC(2026, 0, sequence)).toISOString(),
    storage_key: `secret-${sequence}`,
  };
});

describe("feed route", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns a cursor page and signs thumbnails in one batch", async () => {
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      order: vi.fn(() => query),
      limit: vi.fn().mockResolvedValue({ data: videos, error: null }),
    };
    mocks.createClient.mockResolvedValue({ from: vi.fn(() => query) });
    const createSignedUrls = vi.fn().mockResolvedValue({
      data: [
        { path: "videos/00000000-0000-4000-8000-000000000021/thumb.jpg", signedUrl: "thumb-21" },
        { path: "videos/00000000-0000-4000-8000-000000000020/thumb.jpg", signedUrl: "thumb-20" },
      ],
      error: null,
    });
    mocks.createAdminClient.mockReturnValue({
      storage: { from: () => ({ createSignedUrls }) },
    });

    const response = await getFeed(new Request("https://ratio.example/api/feed?type=reel"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.videos).toHaveLength(20);
    expect(body.videos[0].thumbnailUrl).toBe("thumb-21");
    expect(body.videos[0]).not.toHaveProperty("storage_key");
    expect(createSignedUrls).toHaveBeenCalledTimes(1);
    expect(createSignedUrls.mock.calls[0][0]).toHaveLength(20);
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