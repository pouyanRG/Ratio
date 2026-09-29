import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { thumbnailStorageKey, VIDEO_BUCKET } from "@/lib/storage";

const MAX_ROWS_PER_RUN = 100;
const STALE_AFTER_HOURS = 48;
const MAX_ORPHAN_FOLDERS_PER_RUN = 25;
const VIDEO_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  let deletedCount = 0;
  if (staleIds.length) {
    const { data: deletedVideos, error: deleteError } = await admin
      .from("videos")
      .delete()
      .in("id", staleIds)
      .eq("status", "failed")
      .select("id");

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
    deletedCount = deletedVideos?.length ?? 0;
  }

  const { data: folders, error: listError } = await storage.list("videos", {
    limit: 1000,
  });
  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 502 });
  }

  const folderIds = (folders ?? [])
    .filter((item) => item.id === null && VIDEO_ID_PATTERN.test(item.name))
    .map((item) => item.name);
  const { data: existingVideos, error: lookupError } = folderIds.length
    ? await admin.from("videos").select("id").in("id", folderIds)
    : { data: [], error: null };
  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 500 });
  }

  const existingIds = new Set((existingVideos ?? []).map((video) => video.id));
  const orphanIds = folderIds
    .filter((id) => !existingIds.has(id))
    .slice(0, MAX_ORPHAN_FOLDERS_PER_RUN);
  const orphanPaths: string[] = [];

  for (const orphanId of orphanIds) {
    const { data: objects, error: objectListError } = await storage.list(
      `videos/${orphanId}`,
      { limit: 100 }
    );
    if (objectListError) {
      return NextResponse.json({ error: objectListError.message }, { status: 502 });
    }
    for (const object of objects ?? []) {
      const createdAt = object.created_at ? Date.parse(object.created_at) : Number.NaN;
      if (
        object.id !== null &&
        Number.isFinite(createdAt) &&
        createdAt < Date.parse(cutoff)
      ) {
        orphanPaths.push(`videos/${orphanId}/${object.name}`);
      }
    }
  }

  if (orphanPaths.length) {
    const { error: orphanRemoveError } = await storage.remove(orphanPaths);
    if (orphanRemoveError) {
      return NextResponse.json({ error: orphanRemoveError.message }, { status: 502 });
    }
  }

  return NextResponse.json({
    deleted: deletedCount,
    orphanFilesDeleted: orphanPaths.length,
  });
}