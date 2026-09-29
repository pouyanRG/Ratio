import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createReadUrl, thumbnailStorageKey } from "@/lib/storage";

// Returns short-lived signed URLs for files in the private storage bucket.
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: video } = await supabase
    .from("videos")
    .select("id, storage_key, duration_seconds")
    .eq("id", id)
    .eq("status", "ready")
    .maybeSingle();

  if (!video?.storage_key)
    return NextResponse.json({ error: "not found" }, { status: 404 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { error } = await supabase.rpc("record_video_view", {
      p_video_id: video.id,
    });
    if (error) console.error("Could not record video view", error.message);
  }

  const [videoUrl, thumbnailUrl] = await Promise.all([
    createReadUrl(video.storage_key),
    createReadUrl(thumbnailStorageKey(video.id)).catch(() => null),
  ]);

  return NextResponse.json(
    { videoUrl, thumbnailUrl, duration: video.duration_seconds },
    { headers: { "Cache-Control": "no-store" } }
  );
}
