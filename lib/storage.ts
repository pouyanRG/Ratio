import { createAdminClient } from "@/lib/supabase/admin";
import { isMp4Content, readMp4Duration } from "@/lib/media-validation";

export const VIDEO_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "videos";
const URL_EXPIRES = 3600;

export function videoStorageKey(videoId: string) {
  return `videos/${videoId}/original.mp4`;
}

export function thumbnailStorageKey(videoId: string) {
  return `videos/${videoId}/thumb.jpg`;
}

export async function createReadUrl(path: string) {
  const { data, error } = await createAdminClient()
    .storage.from(VIDEO_BUCKET)
    .createSignedUrl(path, URL_EXPIRES);
  if (error) throw error;
  return data.signedUrl;
}

export async function storageObjectExists(path: string) {
  const { data, error } = await createAdminClient()
    .storage.from(VIDEO_BUCKET)
    .exists(path);
  if (error) {
    if ("status" in error && typeof error.status === "number" && [400, 404].includes(error.status)) {
      return false;
    }
    throw error;
  }
  return data;
}

export async function readStorageMp4Metadata(path: string, fileSize: number) {
  const { data, error } = await createAdminClient()
    .storage.from(VIDEO_BUCKET)
    .createSignedUrl(path, 60);
  if (error) throw error;

  const readRange = async (start: number, end: number) => {
    const response = await fetch(data.signedUrl, {
      headers: { Range: `bytes=${start}-${end}` },
      cache: "no-store",
    });
    if (response.status !== 206) throw new Error("storage range request failed");
    return new Uint8Array(await response.arrayBuffer());
  };

  const header = await readRange(0, Math.min(fileSize - 1, 8191));
  if (!(await isMp4Content(header))) return null;
  const durationSeconds = await readMp4Duration(readRange, fileSize);
  return durationSeconds === null ? null : { durationSeconds };
}