import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import {
  dosyaVideoKey,
  dosyaThumbKey,
  dosyaPresignUpload,
} from "@/lib/dosya";

// Creates the videos row and returns presigned PUT URLs so the browser
// uploads straight to object storage without passing video bytes through Vercel.
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { type, caption, contentType } = await req.json();
  if (!["reel", "long"].includes(type)) {
    return NextResponse.json({ error: "invalid type" }, { status: 400 });
  }
  // The signed request requires an exact Content-Type match.
  const ct = typeof contentType === "string" && contentType.startsWith("video/")
    ? contentType
    : "video/mp4";

  const videoId = randomUUID();
  const videoKey = dosyaVideoKey(videoId);
  const thumbKey = dosyaThumbKey(videoId);

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

  const [uploadUrl, thumbUploadUrl] = await Promise.all([
    dosyaPresignUpload(videoKey, ct),
    dosyaPresignUpload(thumbKey, "image/jpeg"),
  ]);

  return NextResponse.json({ videoId: data.id, videoKey, uploadUrl, thumbUploadUrl });
}
