import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: video } = await supabase
    .from("videos")
    .select("id, video_url, thumbnail_url, duration_seconds")
    .eq("id", id)
    .eq("status", "ready")
    .maybeSingle();

  if (!video?.video_url)
    return NextResponse.json({ error: "not found" }, { status: 404 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isRefresh = new URL(request.url).searchParams.get("refresh") === "1";
  if (user && !isRefresh) {
    const { error } = await supabase.rpc("record_video_view", {
      p_video_id: video.id,
    });
    if (error) console.error("Could not record video view", error.message);
  }

  return NextResponse.json(
    {
      videoUrl: video.video_url,
      thumbnailUrl: video.thumbnail_url,
      duration: video.duration_seconds,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
