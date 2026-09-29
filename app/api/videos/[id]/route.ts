import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { thumbnailStorageKey, VIDEO_BUCKET } from "@/lib/storage";

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: video, error: lookupError } = await supabase
    .from("videos")
    .select("id, storage_key")
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "ready")
    .maybeSingle();
  if (lookupError)
    return NextResponse.json({ error: lookupError.message }, { status: 500 });
  if (!video) return NextResponse.json({ error: "not found" }, { status: 404 });

  const admin = createAdminClient();
  const { error: storageError } = await admin.storage.from(VIDEO_BUCKET).remove([
    video.storage_key,
    thumbnailStorageKey(video.id),
  ]);
  if (storageError)
    return NextResponse.json({ error: "could not delete video files" }, { status: 502 });

  const { data: deletedVideo, error: deleteError } = await admin
    .from("videos")
    .delete()
    .eq("id", video.id)
    .eq("user_id", user.id)
    .eq("status", "ready")
    .select("id")
    .maybeSingle();
  if (deleteError)
    return NextResponse.json({ error: "could not delete video record" }, { status: 500 });
  if (!deletedVideo)
    return NextResponse.json({ error: "video is no longer available" }, { status: 409 });

  return new NextResponse(null, { status: 204 });
}