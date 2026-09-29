import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dosyaPresignRead, dosyaThumbKey } from "@/lib/dosya";

// Returns short-lived signed URLs; media bytes are served directly from storage.
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
    dosyaPresignRead(video.storage_key),
    dosyaPresignRead(dosyaThumbKey(video.id)).catch(() => null),
  ]);

  return NextResponse.json(
    { videoUrl, thumbnailUrl, duration: video.duration_seconds },
    { headers: { "Cache-Control": "no-store" } }
  );
}
