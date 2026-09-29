import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readStorageMp4Metadata } from "@/lib/storage";
import { MAX_VIDEO_SIZE_BYTES } from "@/lib/upload-constraints";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as { videoId?: string };
  if (!body.videoId)
    return NextResponse.json({ error: "videoId required" }, { status: 400 });

  // Ownership check via RLS (authenticated client).
  const { data: video } = await supabase
    .from("videos")
    .select("id, storage_key, status")
    .eq("id", body.videoId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!video) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (video.status === "ready") {
    return NextResponse.json({ status: "ready" });
  }
  if (video.status !== "processing") {
    return NextResponse.json({ error: "upload is no longer active" }, { status: 409 });
  }

  const admin = createAdminClient();
  const storage = admin.storage.from(process.env.SUPABASE_STORAGE_BUCKET || "videos");
  const { data: objectInfo, error: infoError } = await storage.info(video.storage_key);
  if (infoError || !objectInfo)
    return NextResponse.json({ error: "upload not found in storage" }, { status: 400 });
  if (
    typeof objectInfo.size !== "number" ||
    objectInfo.size <= 0 ||
    objectInfo.size > MAX_VIDEO_SIZE_BYTES
  ) {
    return NextResponse.json({ error: "uploaded file exceeds storage limits" }, { status: 413 });
  }
  let mediaMetadata: { durationSeconds: number } | null;
  try {
    mediaMetadata = await readStorageMp4Metadata(video.storage_key, objectInfo.size);
  } catch {
    return NextResponse.json({ error: "could not verify uploaded file" }, { status: 502 });
  }
  if (!mediaMetadata) {
    return NextResponse.json(
      { error: "uploaded file is not a valid MP4 or has no duration metadata" },
      { status: 415 }
    );
  }

  // Only "authenticated" has update(caption) granted, so the status change
  // goes through the service_role admin client.
  const { data: updatedVideo, error: updateError } = await admin
    .from("videos")
    .update({
      status: "ready",
      type: mediaMetadata.durationSeconds <= 90 ? "reel" : "long",
      duration_seconds: Math.round(mediaMetadata.durationSeconds),
      file_size_bytes: objectInfo.size,
    })
    .eq("id", video.id)
    .eq("status", "processing")
    .select("id")
    .maybeSingle();

  if (updateError)
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  if (!updatedVideo) {
    const { data: currentVideo, error: lookupError } = await supabase
      .from("videos")
      .select("status")
      .eq("id", video.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (lookupError)
      return NextResponse.json({ error: lookupError.message }, { status: 500 });
    if (currentVideo?.status === "ready") {
      return NextResponse.json({ status: "ready" });
    }
    return NextResponse.json({ error: "upload is no longer active" }, { status: 409 });
  }

  return NextResponse.json({ status: "ready" });
}
