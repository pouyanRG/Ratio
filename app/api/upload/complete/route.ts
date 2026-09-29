import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { storageObjectExists } from "@/lib/storage";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as { videoId?: string; duration?: number };
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

  if (!(await storageObjectExists(video.storage_key)))
    return NextResponse.json({ error: "upload not found in storage" }, { status: 400 });

  // Only "authenticated" has update(caption) granted, so the status change
  // goes through the service_role admin client.
  const { data: updatedVideo, error: updateError } = await createAdminClient()
    .from("videos")
    .update({
      status: "ready",
      duration_seconds:
        Number.isFinite(body.duration) && (body.duration as number) > 0
          ? Math.round(body.duration as number)
          : null,
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
