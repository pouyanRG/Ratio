import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { thumbnailStorageKey, VIDEO_BUCKET } from "@/lib/storage";

const MAX_ROWS_PER_RUN = 100;
const STALE_AFTER_HOURS = 48;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "cleanup is not configured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const cutoff = new Date(
    Date.now() - STALE_AFTER_HOURS * 60 * 60 * 1000
  ).toISOString();

  const { data: staleProcessing, error: processingError } = await admin
    .from("videos")
    .select("id")
    .eq("status", "processing")
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(MAX_ROWS_PER_RUN);

  if (processingError) {
    return NextResponse.json({ error: processingError.message }, { status: 500 });
  }

  const processingIds = (staleProcessing ?? []).map((video) => video.id);
  if (processingIds.length) {
    const { error: markError } = await admin
        .from("videos")
        .update({ status: "failed" })
        .in("id", processingIds)
        .eq("status", "processing")
        .select("id");
    if (markError) {
      return NextResponse.json({ error: markError.message }, { status: 500 });
    }
  }

  const { data: oldFailed, error: fetchError } = await admin
    .from("videos")
    .select("id, storage_key")
    .eq("status", "failed")
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(MAX_ROWS_PER_RUN);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const staleVideos = oldFailed ?? [];
  const storage = admin.storage.from(VIDEO_BUCKET);
  const paths = staleVideos.flatMap((video) => [
    video.storage_key,
    thumbnailStorageKey(video.id),
  ]);

  if (paths.length) {
    const { error: storageError } = await storage.remove(paths);
    if (storageError) {
      return NextResponse.json({ error: storageError.message }, { status: 502 });
    }
  }

  const staleIds = staleVideos.map((video) => video.id);
  if (!staleIds.length) return NextResponse.json({ deleted: 0 });

  const { data: deletedVideos, error: deleteError } = await admin
    .from("videos")
    .delete()
    .in("id", staleIds)
    .eq("status", "failed")
    .select("id");

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: deletedVideos?.length ?? 0 });
}