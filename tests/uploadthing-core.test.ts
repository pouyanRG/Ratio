import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  deleteFiles: vi.fn(),
  isMp4Content: vi.fn(),
  readMp4Duration: vi.fn(),
  routes: [] as Array<Record<string, unknown>>,
}));

vi.mock("uploadthing/next", () => ({
  createUploadthing: () => (config: unknown) => {
    const route: Record<string, unknown> = {
      config,
      inputSchema: null,
      middleware: null,
      onUploadComplete: null,
    };
    const builder = {
      input(schema: unknown) {
        route.inputSchema = schema;
        return builder;
      },
      middleware(callback: unknown) {
        route.middleware = callback;
        return builder;
      },
      onUploadComplete(callback: unknown) {
        route.onUploadComplete = callback;
        mocks.routes.push(route);
        return route;
      },
    };
    return builder;
  },
}));
vi.mock("uploadthing/server", () => ({
  UploadThingError: class UploadThingError extends Error {},
  UTApi: class {
    deleteFiles = mocks.deleteFiles;
  },
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/media-validation", () => ({
  isMp4Content: mocks.isMp4Content,
  readMp4Duration: mocks.readMp4Duration,
}));

import { ourFileRouter } from "@/app/api/uploadthing/core";

type MiddlewareArgs = { input: { caption?: string; videoId?: string } };
type UploadCompleteArgs = {
  metadata: { userId: string; caption?: string | null; videoId?: string };
  file: { size: number; key: string; ufsUrl: string };
};

function callback<T extends (...args: never[]) => unknown>(route: Record<string, unknown>, key: string) {
  return route[key] as T;
}

function route(index: number) {
  const router = ourFileRouter as unknown as Record<string, Record<string, unknown>>;
  return router[index === 0 ? "videoUploader" : "thumbnailUploader"];
}

function setupUser(profile: { id: string } | null) {
  const profileQuery = {
    select: vi.fn(() => profileQuery),
    eq: vi.fn(() => profileQuery),
    maybeSingle: vi.fn().mockResolvedValue({ data: profile, error: null }),
  };
  mocks.createClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    from: vi.fn(() => profileQuery),
  });
}

describe("UploadThing file router", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
  });

  it("requires an authenticated onboarded user and normalizes the caption", async () => {
    setupUser({ id: "user-1" });
    const middleware = callback<(args: MiddlewareArgs) => Promise<unknown>>(
      route(0),
      "middleware"
    );
    await expect(middleware({ input: { caption: "  hello  " } })).resolves.toEqual({
      userId: "user-1",
      caption: "hello",
    });

    setupUser(null);
    await expect(middleware({ input: { caption: "hello" } })).rejects.toThrow(
      "Complete onboarding first"
    );
  });

  it("validates the uploaded MP4 and stores its measured duration and URL", async () => {
    setupUser({ id: "user-1" });
    mocks.isMp4Content.mockResolvedValue(true);
    mocks.readMp4Duration.mockResolvedValue(89.6);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 206,
        arrayBuffer: async () => new ArrayBuffer(16),
      })
    );
    const query = {
      insert: vi.fn(() => query),
      select: vi.fn(() => query),
      single: vi.fn().mockResolvedValue({ data: { id: "video-1" }, error: null }),
    };
    mocks.createAdminClient.mockReturnValue({ from: vi.fn(() => query) });
    const complete = callback<(args: UploadCompleteArgs) => Promise<unknown>>(
      route(0),
      "onUploadComplete"
    );

    await expect(
      complete({
        metadata: { userId: "user-1", caption: "caption" },
        file: {
          size: 2048,
          key: "uploadthing-video-key",
          ufsUrl: "https://utfs.io/f/uploadthing-video-key",
        },
      })
    ).resolves.toEqual({ videoId: "video-1" });
    expect(query.insert).toHaveBeenCalledWith({
      user_id: "user-1",
      caption: "caption",
      status: "ready",
      type: "reel",
      duration_seconds: 90,
      file_size_bytes: 2048,
      storage_key: "uploadthing-video-key",
      video_url: "https://utfs.io/f/uploadthing-video-key",
    });
  });

  it("rejects and cleans up content that is not an MP4", async () => {
    mocks.isMp4Content.mockResolvedValue(false);
    mocks.deleteFiles.mockResolvedValue({ success: true, deletedCount: 1 });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 206,
        arrayBuffer: async () => new ArrayBuffer(16),
      })
    );
    const complete = callback<(args: UploadCompleteArgs) => Promise<unknown>>(
      route(0),
      "onUploadComplete"
    );

    await expect(
      complete({
        metadata: { userId: "user-1" },
        file: { size: 2048, key: "bad-file", ufsUrl: "https://utfs.io/f/bad-file" },
      })
    ).rejects.toThrow("not a valid MP4");
    expect(mocks.deleteFiles).toHaveBeenCalledWith("bad-file");
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("checks thumbnail ownership before allowing the upload", async () => {
    setupUser({ id: "user-1" });
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "video-1" }, error: null }),
    };
    mocks.createAdminClient.mockReturnValue({ from: vi.fn(() => query) });
    const middleware = callback<(args: MiddlewareArgs) => Promise<unknown>>(
      route(1),
      "middleware"
    );

    await expect(
      middleware({ input: { videoId: "00000000-0000-4000-8000-000000000001" } })
    ).resolves.toEqual({
      userId: "user-1",
      videoId: "00000000-0000-4000-8000-000000000001",
    });
  });
});