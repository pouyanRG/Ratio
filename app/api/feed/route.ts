import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 20;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/;

type FeedCursor = { createdAt: string; id: string };

function decodeCursor(value: string | null): FeedCursor | null | undefined {
  if (!value) return null;
  try {
    const cursor = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as FeedCursor;
    if (
      !TIMESTAMP_PATTERN.test(cursor.createdAt) ||
      !Number.isFinite(Date.parse(cursor.createdAt)) ||
      !UUID_PATTERN.test(cursor.id)
    ) {
      return undefined;
    }
    return cursor;
  } catch {
    return undefined;
  }
}

function encodeCursor(cursor: FeedCursor) {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  if (type && type !== "reel" && type !== "long") {
    return NextResponse.json({ error: "invalid feed type" }, { status: 400 });
  }

  const cursor = decodeCursor(url.searchParams.get("cursor"));
  if (cursor === undefined) {
    return NextResponse.json({ error: "invalid feed cursor" }, { status: 400 });
  }

  const supabase = await createClient();
  let query = supabase
    .from("videos")
    .select(
      "id, type, user_id, thumbnail_url, caption, created_at, duration_seconds, views_count, profiles!videos_user_id_fkey(username, display_name, avatar_url)"
    )
    .eq("status", "ready");
  if (type) query = query.eq("type", type);
  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`
    );
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE + 1);
  if (error) return NextResponse.json({ error: "could not load feed" }, { status: 500 });

  const rows = data ?? [];
  const hasMore = rows.length > PAGE_SIZE;
  const page = rows.slice(0, PAGE_SIZE);
  const videos = page.map((video) => {
    const creator = Array.isArray(video.profiles)
      ? video.profiles[0] ?? null
      : video.profiles;
    return {
      id: video.id,
      type: video.type,
      user_id: video.user_id,
      caption: video.caption,
      created_at: video.created_at,
      duration_seconds: video.duration_seconds,
      views_count: video.views_count,
      creator,
      thumbnailUrl: video.thumbnail_url ?? null,
    };
  });
  const last = page.at(-1);
  const nextCursor = hasMore && last
    ? encodeCursor({ createdAt: last.created_at, id: last.id })
    : null;

  return NextResponse.json(
    { videos, nextCursor },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}