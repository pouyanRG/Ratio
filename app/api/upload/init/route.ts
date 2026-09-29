import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { thumbnailStorageKey, videoStorageKey, VIDEO_BUCKET } from "@/lib/storage";
import {
  MAX_VIDEO_SIZE_BYTES,
  VIDEO_CONTENT_TYPE,
} from "@/lib/upload-constraints";

// Creates the videos row and returns signed upload URLs so the browser
// uploads straight to Supabase Storage without passing video bytes through Vercel.
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { type, caption, contentType, size } = await req.json();
  if (!["reel", "long"].includes(type)) {
    return NextResponse.json({ error: "invalid type" }, { status: 400 });
  }
  if (contentType !== VIDEO_CONTENT_TYPE) {
    return NextResponse.json({ error: "only MP4 videos are allowed" }, { status: 415 });
  }
  if (!Number.isSafeInteger(size) || size <= 0) {
    return NextResponse.json({ error: "invalid file size" }, { status: 400 });
  }
  if (size > MAX_VIDEO_SIZE_BYTES) {
    return NextResponse.json({ error: "video exceeds the 50 MB limit" }, { status: 413 });
  }

  const videoId = randomUUID();
  const videoKey = videoStorageKey(videoId);
  const thumbKey = thumbnailStorageKey(videoId);

  const { data, error } = await supabase
    .from("videos")
    .insert({
      id: videoId,
      user_id: user.id,
      type,
      storage_key: videoKey,
      caption: caption ? String(caption).slice(0, 2200) : null,
      status: "processing",
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const storage = createAdminClient().storage.from(VIDEO_BUCKET);
  const [videoUpload, thumbUpload] = await Promise.all([
    storage.createSignedUploadUrl(videoKey),
    storage.createSignedUploadUrl(thumbKey),
  ]);

  if (videoUpload.error || thumbUpload.error) {
    return NextResponse.json(
      { error: videoUpload.error?.message ?? thumbUpload.error?.message ?? "storage signing failed" },
      { status: 502 }
    );
  }

  return NextResponse.json({
    videoId: data.id,
    videoKey,
    uploadUrl: videoUpload.data.signedUrl,
    thumbUploadUrl: thumbUpload.data.signedUrl,
  });
}
