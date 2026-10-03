"use client";
import { useEffect, useRef, useState } from "react";
import { getVideoFileError } from "@/lib/upload-constraints";
import { useUploadThing } from "@/lib/uploadthing";

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
    return { thumbnail };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function useUpload() {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const aborted = useRef(false);
  const { startUpload: uploadVideo } = useUploadThing("videoUploader", {
    onUploadProgress: setProgress,
  });
  const { startUpload: uploadThumb } = useUploadThing("thumbnailUploader");

  useEffect(() => {
    aborted.current = false;
    return () => {
      aborted.current = true;
    };
  }, []);

  async function start(file: File, opts: { caption: string }) {
    setError("");
    setProgress(0);
    setVideoId(null);

    const validationError = getVideoFileError(file);
    if (validationError) {
      setStatus("failed");
      setError(validationError);
      return;
    }

    setStatus("uploading");

    try {
      const result = await uploadVideo([file], { caption: opts.caption });
      const newVideoId = result?.[0]?.serverData?.videoId;
      if (!newVideoId) throw new Error("upload failed");
      if (aborted.current) return;
      setVideoId(newVideoId);

      setStatus("finalizing");
      const { thumbnail } = await extractMeta(file);

      if (thumbnail) {
        try {
          await uploadThumb(
            [new File([thumbnail], "thumb.jpg", { type: "image/jpeg" })],
            { videoId: newVideoId }
          );
        } catch {
          // thumbnail is optional
        }
      }
      if (aborted.current) return;
      setStatus("ready");
    } catch (e) {
      if (aborted.current) return;
      setStatus("failed");
      setError(e instanceof Error ? e.message : "upload failed");
    }
  }

  return { start, progress, status, error, videoId };
}
