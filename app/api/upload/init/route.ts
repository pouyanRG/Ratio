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

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    return NextResponse.json({ error: "could not verify your profile" }, { status: 500 });
  }
  if (!profile) {
    return NextResponse.json(
      { error: "complete onboarding before uploading" },
      { status: 409 }
    );
  }

  const videoId = randomUUID();
  const videoKey = videoStorageKey(videoId);
  const thumbKey = thumbnailStorageKey(videoId);

  const { data: reservedVideoId, error: reserveError } = await supabase.rpc(
    "reserve_video_upload",
    {
      p_video_id: videoId,
      p_type: type,
      p_storage_key: videoKey,
      p_caption: caption ? String(caption).slice(0, 2200) : null,
    }
  );

  if (reserveError) {
    const message = reserveError.message;
    if (message.includes("UPLOAD_PROFILE_REQUIRED")) {
      return NextResponse.json(
        { error: "complete onboarding before uploading" },
        { status: 409 }
      );
    }
    if (message.includes("UPLOAD_ACTIVE_LIMIT") || message.includes("UPLOAD_DAILY_LIMIT")) {
      return NextResponse.json(
        { error: "upload quota reached; try again later" },
        { status: 429 }
      );
    }
    if (message.includes("UPLOAD_")) {
      return NextResponse.json(
        { error: "video storage quota reached" },
        { status: 507 }
      );
    }
    return NextResponse.json({ error: "could not reserve upload" }, { status: 500 });
  }
  if (!reservedVideoId) {
    return NextResponse.json({ error: "could not reserve upload" }, { status: 500 });
  }

  const admin = createAdminClient();
  const storage = admin.storage.from(VIDEO_BUCKET);
  const [videoUpload, thumbUpload] = await Promise.all([
    storage.createSignedUploadUrl(videoKey),
    storage.createSignedUploadUrl(thumbKey),
  ]);

  if (videoUpload.error || thumbUpload.error) {
    await admin.from("videos").delete().eq("id", reservedVideoId);
    return NextResponse.json(
      { error: videoUpload.error?.message ?? thumbUpload.error?.message ?? "storage signing failed" },
      { status: 502 }
    );
  }

  return NextResponse.json({
    videoId: reservedVideoId,
    videoKey,
    uploadUrl: videoUpload.data.signedUrl,
    thumbUploadUrl: thumbUpload.data.signedUrl,
  });
}
