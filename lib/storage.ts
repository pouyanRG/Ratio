import { createAdminClient } from "@/lib/supabase/admin";
import { isMp4Content } from "@/lib/media-validation";

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

export async function storageObjectIsMp4(path: string) {
  const { data, error } = await createAdminClient()
    .storage.from(VIDEO_BUCKET)
    .createSignedUrl(path, 60);
  if (error) throw error;

  const response = await fetch(data.signedUrl, {
    headers: { Range: "bytes=0-8191" },
    cache: "no-store",
  });
  if (response.status !== 206 || !response.body) return false;

  const reader = response.body.getReader();
  try {
    const { value } = await reader.read();
    return isMp4Content(value ?? new Uint8Array());
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}