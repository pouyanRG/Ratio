import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UTApi } from "uploadthing/server";

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
    .select("id, storage_key, thumbnail_key")
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "ready")
    .maybeSingle();
  if (lookupError)
    return NextResponse.json({ error: lookupError.message }, { status: 500 });
  if (!video) return NextResponse.json({ error: "not found" }, { status: 404 });

  const admin = createAdminClient();
  const { data: claimed, error: claimError } = await admin
    .from("videos")
    .update({ status: "failed" })
    .eq("id", video.id)
    .eq("user_id", user.id)
    .eq("status", "ready")
    .select("id")
    .maybeSingle();
  if (claimError)
    return NextResponse.json({ error: "could not delete video" }, { status: 500 });
  if (!claimed)
    return NextResponse.json({ error: "video is no longer available" }, { status: 409 });

  try {
    const keys = [video.storage_key, video.thumbnail_key].filter(
      (key): key is string => !!key
    );
    const deletion = keys.length
      ? await new UTApi().deleteFiles(keys)
      : { success: true, deletedCount: 0 };
    if (!deletion.success) throw new Error("UploadThing file deletion failed");
  } catch {
    await admin
      .from("videos")
      .update({ status: "ready" })
      .eq("id", video.id)
      .eq("user_id", user.id)
      .eq("status", "failed");
    return NextResponse.json({ error: "could not delete video files" }, { status: 502 });
  }

  const { error: deleteError } = await admin
    .from("videos")
    .delete()
    .eq("id", video.id)
    .eq("status", "failed");
  if (deleteError)
    return NextResponse.json({ error: "could not delete video record" }, { status: 500 });

  return new NextResponse(null, { status: 204 });
}