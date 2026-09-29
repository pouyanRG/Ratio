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

  it("refreshes its signed URL before the one-hour expiry", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const refresh = String(input).includes("refresh=1");
      return {
        ok: true,
        json: async () => ({
          videoUrl: refresh ? "https://storage.example/renewed" : "https://storage.example/initial",
          thumbnailUrl: null,
        }),
      };
    });
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
    expect(player.src).toBe("https://storage.example/initial");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(55 * 60 * 1000);
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/stream/video-1?refresh=1", {
      cache: "no-store",
    });
    expect(player.src).toBe("https://storage.example/renewed");
  });

  it("requests a fresh URL after a playback error", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const refresh = String(input).includes("refresh=1");
      return {
        ok: true,
        json: async () => ({
          videoUrl: refresh ? "https://storage.example/recovered" : "https://storage.example/expired",
          thumbnailUrl: null,
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getByLabelText } = render(
      <VideoPlayer videoId="video-2" title="expired video" />
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.error(getByLabelText("expired video"));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/stream/video-2?refresh=1", {
      cache: "no-store",
    });
    expect((getByLabelText("expired video") as HTMLVideoElement).src).toBe(
      "https://storage.example/recovered"
    );
  });
});