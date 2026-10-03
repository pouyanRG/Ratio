// @vitest-environment jsdom

import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VideoPlayer } from "@/components/video-player";

describe("VideoPlayer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps a persistent UploadThing URL without periodic refresh requests", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        videoUrl: "https://utfs.io/f/persistent-video",
        thumbnailUrl: null,
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { getByLabelText } = render(
      <VideoPlayer videoId="video-1" title="test video" />
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const player = getByLabelText("test video") as HTMLVideoElement;
    expect(fetchMock).toHaveBeenCalledWith("/api/stream/video-1", { cache: "no-store" });
    expect(player.src).toBe("https://utfs.io/f/persistent-video");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(55 * 60 * 1000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(player.src).toBe("https://utfs.io/f/persistent-video");
  });

  it("retries without recording another view after a playback error", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        videoUrl: "https://utfs.io/f/persistent-video",
        thumbnailUrl: null,
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { getByLabelText } = render(
      <VideoPlayer videoId="video-2" title="video with playback error" />
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.error(getByLabelText("video with playback error"));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenLastCalledWith("/api/stream/video-2?refresh=1", {
      cache: "no-store",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((getByLabelText("video with playback error") as HTMLVideoElement).src).toBe(
      "https://utfs.io/f/persistent-video"
    );
  });
});