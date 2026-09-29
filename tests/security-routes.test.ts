import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  createReadUrl: vi.fn(),
  storageObjectIsMp4: vi.fn(),
  thumbnailStorageKey: vi.fn((id: string) => `videos/${id}/thumb.jpg`),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/storage", () => ({
  VIDEO_BUCKET: "videos",
  createReadUrl: mocks.createReadUrl,
  storageObjectIsMp4: mocks.storageObjectIsMp4,
  thumbnailStorageKey: mocks.thumbnailStorageKey,
}));

import { POST as completeUpload } from "@/app/api/upload/complete/route";
import { GET as getStream } from "@/app/api/stream/[id]/route";
import { DELETE as deleteVideo } from "@/app/api/videos/[id]/route";
import { GET as runCleanup } from "@/app/api/cron/cleanup-uploads/route";

function videoQuery(video: unknown) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn().mockResolvedValue({ data: video, error: null }),
  };
  return query;
}

function request(body?: unknown) {
  return new Request("https://ratio.example/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? { videoId: "video-1", duration: 12 }),
  });
}

describe("security-sensitive routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.CRON_SECRET = "test-cron-secret";
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("makes complete idempotent for an already-ready owned video", async () => {
    const query = videoQuery({ id: "video-1", storage_key: "videos/video-1/original.mp4", status: "ready" });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn(() => query),
    });

    const response = await completeUpload(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ready" });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("does not mark a falsely labelled file ready", async () => {
    const query = videoQuery({ id: "video-1", storage_key: "videos/video-1/original.mp4", status: "processing" });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn(() => query),
    });
    const update = vi.fn();
    mocks.createAdminClient.mockReturnValue({
      storage: { from: () => ({ info: vi.fn().mockResolvedValue({ data: { size: 100 }, error: null }) }) },
      from: () => ({ update }),
    });
    mocks.storageObjectIsMp4.mockResolvedValue(false);

    const response = await completeUpload(request());
    expect(response.status).toBe(415);
    expect(update).not.toHaveBeenCalled();
  });

  it("stores measured size and ignores browser duration when completing", async () => {
    const query = videoQuery({ id: "video-1", storage_key: "videos/video-1/original.mp4", status: "processing" });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn(() => query),
    });
    const updateResult = {
      eq: vi.fn(),
      select: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "video-1" }, error: null }),
    };
    updateResult.eq.mockReturnValue(updateResult);
    updateResult.select.mockReturnValue(updateResult);
    const update = vi.fn().mockReturnValue(updateResult);
    mocks.createAdminClient.mockReturnValue({
      storage: { from: () => ({ info: vi.fn().mockResolvedValue({ data: { size: 2048 }, error: null }) }) },
      from: () => ({ update }),
    });
    mocks.storageObjectIsMp4.mockResolvedValue(true);

    const response = await completeUpload(request({ videoId: "video-1", duration: 999999 }));
    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith({
      status: "ready",
      duration_seconds: null,
      file_size_bytes: 2048,
    });
  });

  it("returns a fresh signed stream URL only for ready videos", async () => {
    const query = videoQuery({ id: "video-1", storage_key: "videos/video-1/original.mp4", duration_seconds: 12 });
    const rpc = vi.fn().mockResolvedValue({ error: null });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn(() => query),
      rpc,
    });
    mocks.createReadUrl
      .mockResolvedValueOnce("https://storage.example/video")
      .mockResolvedValueOnce("https://storage.example/thumb");

    const response = await getStream(new Request("https://ratio.example/api/stream/video-1"), {
      params: Promise.resolve({ id: "video-1" }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ videoUrl: "https://storage.example/video" });
    expect(rpc).toHaveBeenCalledWith("record_video_view", { p_video_id: "video-1" });
  });

  it("rejects cleanup requests without the cron bearer token", async () => {
    const response = await runCleanup(new Request("https://ratio.example/api/cron/cleanup-uploads"));
    expect(response.status).toBe(401);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("requires authentication before deleting a video", async () => {
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });
    const response = await deleteVideo(
      new Request("https://ratio.example/api/videos/video-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "video-1" }) }
    );
    expect(response.status).toBe(401);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("scans for cascade-orphaned storage folders when no stale rows exist", async () => {
    const emptyQuery = {
      select: vi.fn(() => emptyQuery),
      eq: vi.fn(() => emptyQuery),
      lt: vi.fn(() => emptyQuery),
      order: vi.fn(() => emptyQuery),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    const storageList = vi.fn().mockResolvedValue({ data: [], error: null });
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn(() => emptyQuery),
      storage: { from: () => ({ list: storageList }) },
    });

    const response = await runCleanup(
      new Request("https://ratio.example/api/cron/cleanup-uploads", {
        headers: { Authorization: "Bearer test-cron-secret" },
      })
    );
    expect(response.status).toBe(200);
    expect(storageList).toHaveBeenCalledWith("videos", { limit: 1000 });
    expect(await response.json()).toMatchObject({ deleted: 0, orphanFilesDeleted: 0 });
  });
});