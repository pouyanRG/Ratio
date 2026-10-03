import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  deleteFiles: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("uploadthing/server", () => ({
  UTApi: class {
    deleteFiles = mocks.deleteFiles;
  },
}));

import { GET as getStream } from "@/app/api/stream/[id]/route";
import { DELETE as deleteVideo } from "@/app/api/videos/[id]/route";

function videoQuery(video: unknown) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn().mockResolvedValue({ data: video, error: null }),
  };
  return query;
}

function setupAuthenticatedUser(query: ReturnType<typeof videoQuery>) {
  const rpc = vi.fn().mockResolvedValue({ error: null });
  mocks.createClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    from: vi.fn(() => query),
    rpc,
  });
  return rpc;
}

function setupDeleteAdmin() {
  const events: string[] = [];
  const claim = {
    eq: vi.fn(() => claim),
    select: vi.fn(() => claim),
    maybeSingle: vi.fn(async () => {
      events.push("claim");
      return { data: { id: "video-1" }, error: null };
    }),
  };
  const deleteRecord = {
    eq: vi.fn(() => deleteRecord),
  };
  deleteRecord.eq.mockImplementation(() => {
    events.push("delete-row");
    return deleteRecord;
  });
  const restore = { eq: vi.fn(() => restore) };
  let call = 0;
  const from = vi.fn(() => {
    call += 1;
    return {
      update: () => (call === 1 ? claim : restore),
      delete: () => deleteRecord,
    };
  });
  mocks.createAdminClient.mockReturnValue({ from });
  return { events, from };
}

describe("security-sensitive routes", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns the public UploadThing URL only for ready videos and records a view", async () => {
    const query = videoQuery({
      id: "video-1",
      video_url: "https://utfs.io/f/video-key",
      thumbnail_url: "https://utfs.io/f/thumb-key",
      duration_seconds: 12,
    });
    const rpc = setupAuthenticatedUser(query);

    const response = await getStream(new Request("https://ratio.example/api/stream/video-1"), {
      params: Promise.resolve({ id: "video-1" }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      videoUrl: "https://utfs.io/f/video-key",
      thumbnailUrl: "https://utfs.io/f/thumb-key",
      duration: 12,
    });
    expect(rpc).toHaveBeenCalledWith("record_video_view", { p_video_id: "video-1" });
  });

  it("does not record a new view when refreshing a stream URL", async () => {
    const query = videoQuery({ id: "video-1", video_url: "https://utfs.io/f/video-key" });
    const rpc = setupAuthenticatedUser(query);
    const response = await getStream(
      new Request("https://ratio.example/api/stream/video-1?refresh=1"),
      { params: Promise.resolve({ id: "video-1" }) }
    );
    expect(response.status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns not found for ready rows without an UploadThing URL", async () => {
    setupAuthenticatedUser(videoQuery({ id: "video-1", video_url: null }));
    const response = await getStream(new Request("https://ratio.example/api/stream/video-1"), {
      params: Promise.resolve({ id: "video-1" }),
    });
    expect(response.status).toBe(404);
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

  it("deletes only the owned video and thumbnail UploadThing keys", async () => {
    const lookup = videoQuery({
      id: "video-1",
      storage_key: "video-key",
      thumbnail_key: "thumb-key",
    });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn(() => lookup),
    });
    const { events } = setupDeleteAdmin();
    mocks.deleteFiles.mockImplementation(async () => {
      events.push("delete-files");
      return { success: true, deletedCount: 2 };
    });

    const response = await deleteVideo(
      new Request("https://ratio.example/api/videos/video-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "video-1" }) }
    );
    expect(response.status).toBe(204);
    expect(mocks.deleteFiles).toHaveBeenCalledWith(["video-key", "thumb-key"]);
    expect(events).toEqual(["claim", "delete-files", "delete-row", "delete-row"]);
  });

  it("restores the video row when UploadThing file deletion fails", async () => {
    const lookup = videoQuery({ id: "video-1", storage_key: "video-key", thumbnail_key: null });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn(() => lookup),
    });
    const { from } = setupDeleteAdmin();
    mocks.deleteFiles.mockRejectedValue(new Error("UploadThing unavailable"));

    const response = await deleteVideo(
      new Request("https://ratio.example/api/videos/video-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "video-1" }) }
    );
    expect(response.status).toBe(502);
    expect(from).toHaveBeenCalledTimes(2);
  });
});