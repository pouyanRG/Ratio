import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError, UTApi } from "uploadthing/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMp4Content, readMp4Duration } from "@/lib/media-validation";
import { MAX_VIDEO_SIZE_BYTES } from "@/lib/upload-constraints";

const f = createUploadthing();
const utapi = new UTApi();

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UploadThingError("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) throw new UploadThingError("Complete onboarding first");
  return user.id;
}

export const ourFileRouter = {
  videoUploader: f({ "video/mp4": { maxFileSize: "64MB", maxFileCount: 1 } })
    .input(z.object({ caption: z.string().max(2200).optional() }))
    .middleware(async ({ input }) => ({
      userId: await requireUser(),
      caption: input.caption?.trim() || null,
    }))
    .onUploadComplete(async ({ metadata, file }) => {
      const reject = async (message: string): Promise<never> => {
        try {
          await utapi.deleteFiles(file.key);
        } catch {
          // Keep the validation error even if cleanup is temporarily unavailable.
        }
        throw new UploadThingError(message);
      };

      if (file.size > MAX_VIDEO_SIZE_BYTES) return reject("video exceeds 50 MB");

      const readRange = async (start: number, end: number) => {
        const response = await fetch(file.ufsUrl, {
          headers: { Range: `bytes=${start}-${end}` },
          cache: "no-store",
        });
        if (!response.ok) throw new Error("range request failed");
        const bytes = new Uint8Array(await response.arrayBuffer());
        return response.status === 206 ? bytes : bytes.subarray(start, end + 1);
      };

      let validMp4 = false;
      let duration: number | null = null;
      try {
        const header = await readRange(0, Math.min(file.size - 1, 8191));
        validMp4 = await isMp4Content(header);
        if (validMp4) duration = await readMp4Duration(readRange, file.size);
      } catch {
        return reject("could not verify uploaded file");
      }
      if (!validMp4) return reject("not a valid MP4");
      if (duration === null) return reject("no duration metadata");

      const { data, error } = await createAdminClient()
        .from("videos")
        .insert({
          user_id: metadata.userId,
          caption: metadata.caption,
          status: "ready",
          type: duration <= 90 ? "reel" : "long",
          duration_seconds: Math.round(duration),
          file_size_bytes: file.size,
          storage_key: file.key,
          video_url: file.ufsUrl,
        })
        .select("id")
        .single();

      if (error || !data) return reject("could not save video");
      return { videoId: data.id as string };
    }),

  thumbnailUploader: f({ "image/jpeg": { maxFileSize: "1MB", maxFileCount: 1 } })
    .input(z.object({ videoId: z.string().uuid() }))
    .middleware(async ({ input }) => {
      const userId = await requireUser();
      const { data } = await createAdminClient()
        .from("videos")
        .select("id")
        .eq("id", input.videoId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!data) throw new UploadThingError("Video not found");
      return { userId, videoId: input.videoId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const { data, error } = await createAdminClient()
        .from("videos")
        .update({ thumbnail_url: file.ufsUrl, thumbnail_key: file.key })
        .eq("id", metadata.videoId)
        .eq("user_id", metadata.userId)
        .select("id")
        .maybeSingle();

      if (error || !data) {
        try {
          await utapi.deleteFiles(file.key);
        } catch {
          // The uploaded thumbnail is optional; the video remains usable.
        }
        throw new UploadThingError("could not save thumbnail");
      }
      return { ok: true };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;