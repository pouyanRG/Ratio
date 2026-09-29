"use client";
import { useEffect, useRef, useState } from "react";

type Status = "idle" | "uploading" | "finalizing" | "ready" | "failed";

// Extracts duration + a JPEG frame (for the grid thumbnail) from the local
// file before upload, so no server-side transcoding is ever needed.
async function extractMeta(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.preload = "metadata";
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("metadata read failed"));
    });

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    let thumbnail: Blob | null = null;
    try {
      video.currentTime = Math.min(1, duration / 2 || 0.1);
      await new Promise<void>((resolve) => {
        video.onseeked = () => resolve();
        setTimeout(resolve, 2000);
      });
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 480 / (video.videoWidth || 480));
      canvas.width = Math.round((video.videoWidth || 480) * scale);
      canvas.height = Math.round((video.videoHeight || 852) * scale);
      canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
      thumbnail = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.8)
      );
    } catch {
      // thumbnail is best-effort; playback still works without it
    }
    return { duration, thumbnail };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function xhrUpload(url: string, file: Blob, contentType: string, onProgress: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`upload failed: ${xhr.status}`));
    xhr.onerror = () => reject(new Error("upload failed: network error"));
    xhr.send(file);
  });
}

export function useUpload() {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const aborted = useRef(false);

  useEffect(() => {
    aborted.current = false;
    return () => {
      aborted.current = true;
    };
  }, []);

  async function start(
    file: File,
    opts: { type: "reel" | "long"; caption: string }
  ) {
    setError("");
    setProgress(0);
    setStatus("uploading");

    try {
      const initRes = await fetch("/api/upload/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...opts, contentType: file.type }),
      });
      if (!initRes.ok) {
        throw new Error(
          ((await initRes.json()) as { error?: string }).error ?? "init failed"
        );
      }
      const init = (await initRes.json()) as {
        videoId: string;
        uploadUrl: string;
        thumbUploadUrl: string;
      };
      if (aborted.current) return;
      setVideoId(init.videoId);

      await xhrUpload(init.uploadUrl, file, file.type || "video/mp4", setProgress);
      if (aborted.current) return;

      setStatus("finalizing");
      const { duration, thumbnail } = await extractMeta(file);

      if (thumbnail) {
        try {
          await xhrUpload(init.thumbUploadUrl, thumbnail, "image/jpeg", () => {});
        } catch {
          // thumbnail is optional
        }
      }

      const completeRes = await fetch("/api/upload/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: init.videoId, duration }),
      });
      if (!completeRes.ok) {
        throw new Error(
          ((await completeRes.json()) as { error?: string }).error ?? "complete failed"
        );
      }
      setStatus("ready");
    } catch (e) {
      if (aborted.current) return;
      setStatus("failed");
      setError(e instanceof Error ? e.message : "upload failed");
    }
  }

  return { start, progress, status, error, videoId };
}
