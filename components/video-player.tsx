"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type StreamData = {
  videoId: string;
  videoUrl: string;
  thumbnailUrl: string | null;
};

type VideoPlayerProps = {
  videoId: string;
  title: string;
  posterUrl?: string | null;
  active?: boolean;
  autoPlay?: boolean;
  className?: string;
};

const REFRESH_INTERVAL_MS = 55 * 60 * 1000;

export function VideoPlayer({
  videoId,
  title,
  posterUrl,
  active = true,
  autoPlay = false,
  className = "",
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const refreshRef = useRef<() => void>(() => {});
  const [stream, setStream] = useState<StreamData | null>(null);
  const [muted, setMuted] = useState(true);
  const [errorState, setErrorState] = useState<{ videoId: string; message: string } | null>(null);
  const loading = !stream || stream.videoId !== videoId;
  const error = errorState?.videoId === videoId ? errorState.message : "";

  useEffect(() => {
    const player = videoRef.current;
    if (!active) {
      player?.pause();
      return;
    }

    let mounted = true;
    let refreshing = false;

    const loadStream = async (refresh: boolean) => {
      if (refreshing) return;
      refreshing = true;
      try {
        const response = await fetch(
          `/api/stream/${encodeURIComponent(videoId)}${refresh ? "?refresh=1" : ""}`,
          { cache: "no-store" }
        );
        if (!response.ok) throw new Error("ویدیو در دسترس نیست.");
        const data = (await response.json()) as Omit<StreamData, "videoId">;
        if (mounted) {
          setStream({ ...data, videoId });
          setErrorState(null);
        }
      } catch {
        if (mounted) setErrorState({ videoId, message: "بارگذاری ویدیو ناموفق بود." });
      } finally {
        refreshing = false;
      }
    };

    refreshRef.current = () => void loadStream(true);
    if (stream?.videoId !== videoId) void loadStream(false);
    const timer = window.setInterval(() => void loadStream(true), REFRESH_INTERVAL_MS);

    return () => {
      mounted = false;
      window.clearInterval(timer);
      refreshRef.current = () => {};
    };
  }, [active, stream?.videoId, videoId]);

  useEffect(() => {
    const player = videoRef.current;
    if (!player || !stream?.videoUrl || !active) return;

    const previousTime = player.currentTime;
    const wasPlaying = !player.paused || autoPlay;
    const restorePlayback = () => {
      if (previousTime > 0 && Number.isFinite(player.duration)) {
        player.currentTime = Math.min(previousTime, player.duration);
      }
      if (wasPlaying) void player.play().catch(() => undefined);
    };

    player.addEventListener("loadedmetadata", restorePlayback, { once: true });
    player.src = stream.videoUrl;
    player.load();
    return () => player.removeEventListener("loadedmetadata", restorePlayback);
  }, [active, autoPlay, stream?.videoUrl]);

  const poster = stream?.thumbnailUrl ?? posterUrl ?? undefined;

  return (
    <div className={`relative overflow-hidden bg-black ${className}`}>
      {active && (
        <video
          ref={videoRef}
          className="h-full w-full object-contain"
          aria-label={title}
          controls
          playsInline
          autoPlay={autoPlay}
          muted={muted}
          preload="metadata"
          poster={poster}
          onError={() => refreshRef.current()}
        />
      )}
      {!active && poster && (
        <Image
          className="object-cover"
          src={poster}
          alt=""
          fill
          unoptimized
          sizes="100vw"
        />
      )}
      {loading && active && (
        <p className="pointer-events-none absolute inset-x-0 top-3 text-center text-sm text-white">
          در حال بارگذاری…
        </p>
      )}
      {error && active && (
        <div className="absolute inset-0 grid place-content-center gap-3 bg-black/70 p-4 text-center text-white">
          <p role="alert">{error}</p>
          <button
            className="mx-auto rounded border border-white/60 px-4 py-2"
            onClick={() => refreshRef.current()}
          >
            تلاش دوباره
          </button>
        </div>
      )}
      {active && (
        <button
          className="absolute left-3 top-3 rounded bg-black/60 px-3 py-2 text-sm text-white"
          onClick={() => setMuted((current) => !current)}
          aria-label={muted ? "روشن‌کردن صدا" : "قطع صدا"}
        >
          {muted ? "صدا روشن" : "قطع صدا"}
        </button>
      )}
    </div>
  );
}