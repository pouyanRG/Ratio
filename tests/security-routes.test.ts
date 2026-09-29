import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  createReadUrl: vi.fn(),
  readStorageMp4Metadata: vi.fn(),
  thumbnailStorageKey: vi.fn((id: string) => `videos/${id}/thumb.jpg`),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/storage", () => ({
  VIDEO_BUCKET: "videos",
  createReadUrl: mocks.createReadUrl,
  readStorageMp4Metadata: mocks.readStorageMp4Metadata,
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
    mocks.readStorageMp4Metadata.mockResolvedValue(null);

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
    mocks.readStorageMp4Metadata.mockResolvedValue({ durationSeconds: 12 });

    const response = await completeUpload(request({ videoId: "video-1", duration: 999999 }));
    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith({
      status: "ready",
      type: "reel",
      duration_seconds: 12,
      file_size_bytes: 2048,
    });
  });

  it("classifies durations above 90 seconds as long videos", async () => {
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
    mocks.readStorageMp4Metadata.mockResolvedValue({ durationSeconds: 91 });

    const response = await completeUpload(request({ videoId: "video-1" }));
    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ type: "long", duration_seconds: 91 }));
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

  it("does not record a new view when refreshing a stream URL", async () => {
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

    const response = await getStream(
      new Request("https://ratio.example/api/stream/video-1?refresh=1")
    , { params: Promise.resolve({ id: "video-1" }) });
    expect(response.status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
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

  it("claims a ready video before removing files and its row", async () => {
    const events: string[] = [];
    const lookup = videoQuery({ id: "video-1", storage_key: "videos/video-1/original.mp4" });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn(() => lookup),
    });
    const claim = {
      eq: vi.fn(() => claim),
      select: vi.fn(() => claim),
      maybeSingle: vi.fn(async () => { events.push("claim"); return { data: { id: "video-1" }, error: null }; }),
    };
    const deleteRecord = {
      eq: vi.fn(() => deleteRecord),
    };
    deleteRecord.eq.mockImplementation(() => { events.push("delete"); return deleteRecord; });
    const from = vi.fn()
      .mockReturnValueOnce({ update: () => claim })
      .mockReturnValueOnce({ delete: () => deleteRecord });
    const remove = vi.fn(async () => { events.push("remove"); return { error: null }; });
    mocks.thumbnailStorageKey.mockImplementation((id) => `videos/${id}/thumb.jpg`);
    mocks.createAdminClient.mockReturnValue({ from, storage: { from: () => ({ remove }) } });

    const response = await deleteVideo(
      new Request("https://ratio.example/api/videos/video-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "video-1" }) }
    );
    expect(response.status).toBe(204);
    expect(events).toEqual(["claim", "remove", "delete", "delete"]);
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
    expect(storageList).toHaveBeenCalledWith("videos", { limit: 1000, offset: 0 });
    expect(await response.json()).toMatchObject({ deleted: 0, orphanFilesDeleted: 0 });
  });

  it("pages through orphan folders and batches video lookups by 200 ids", async () => {
    const folders = Array.from({ length: 1001 }, (_, index) => ({
      id: null,
      name: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    }));
    const storageList = vi.fn(async (path: string, options: { limit: number; offset?: number }) => ({
      data: path === "videos"
        ? folders.slice(options.offset ?? 0, (options.offset ?? 0) + options.limit)
        : [],
      error: null,
    }));
    const batches: string[][] = [];
    let fromCount = 0;
    const from = vi.fn(() => {
      fromCount += 1;
      if (fromCount <= 2) {
        const query = {
          select: vi.fn(() => query),
          eq: vi.fn(() => query),
          lt: vi.fn(() => query),
          order: vi.fn(() => query),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
        return query;
      }
      const query = {
        select: vi.fn(() => query),
        in: vi.fn((_column: string, ids: string[]) => {
          batches.push(ids);
          return Promise.resolve({ data: ids.map((id) => ({ id })), error: null });
        }),
      };
      return query;
    });
    mocks.createAdminClient.mockReturnValue({
      from,
      storage: { from: () => ({ list: storageList }) },
    });

    const response = await runCleanup(
      new Request("https://ratio.example/api/cron/cleanup-uploads", {
        headers: { Authorization: "Bearer test-cron-secret" },
      })
    );

    expect(response.status).toBe(200);
    expect(storageList).toHaveBeenNthCalledWith(1, "videos", { limit: 1000, offset: 0 });
    expect(storageList).toHaveBeenNthCalledWith(2, "videos", { limit: 1000, offset: 1000 });
    expect(batches.map((batch) => batch.length)).toEqual([200, 200, 200, 200, 200, 1]);
  });
});