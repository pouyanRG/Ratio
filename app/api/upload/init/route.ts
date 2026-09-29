import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { thumbnailStorageKey, videoStorageKey, VIDEO_BUCKET } from "@/lib/storage";

// Creates the videos row and returns signed upload URLs so the browser
// uploads straight to Supabase Storage without passing video bytes through Vercel.
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { type, caption } = await req.json();
  if (!["reel", "long"].includes(type)) {
    return NextResponse.json({ error: "invalid type" }, { status: 400 });
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
