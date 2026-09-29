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

  const [videoUrl, thumbnailUrl] = await Promise.all([
    createReadUrl(video.storage_key),
    createReadUrl(thumbnailStorageKey(video.id)).catch(() => null),
  ]);

  return NextResponse.json(
    { videoUrl, thumbnailUrl, duration: video.duration_seconds },
    { headers: { "Cache-Control": "no-store" } }
  );
}
