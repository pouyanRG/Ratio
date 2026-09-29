import { createAdminClient } from "@/lib/supabase/admin";

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