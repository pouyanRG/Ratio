import Link from "next/link";
import { notFound } from "next/navigation";
import { VideoPlayer } from "@/components/video-player";
import { createClient } from "@/lib/supabase/server";

export default async function WatchPage({ params }: PageProps<"/v/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: video } = await supabase
    .from("videos")
    .select(
      "id, type, caption, duration_seconds, views_count, profiles!videos_user_id_fkey(username, display_name, avatar_url)"
    )
    .eq("id", id)
    .eq("status", "ready")
    .maybeSingle();

  if (!video) notFound();
  const creator = Array.isArray(video.profiles)
    ? video.profiles[0] ?? null
    : video.profiles;

  return (
    <main className="mx-auto grid w-full max-w-6xl content-start gap-5 px-4 py-6 md:px-8">
      <div className="flex items-center justify-between gap-4">
        <Link className="text-sm text-zinc-500 underline" href="/">
          بازگشت به فید
        </Link>
        {video.type === "reel" && (
          <Link className="text-sm text-zinc-500 underline" href="/reels">
            دیدن ریلزها
          </Link>
        )}
      </div>
      <VideoPlayer
        videoId={video.id}
        title={video.caption || "ویدیو"}
        className="aspect-video w-full rounded"
      />
      <section className="grid gap-3">
        <h1 className="text-xl font-semibold">{video.caption || "ویدیو"}</h1>
        <p className="text-sm text-zinc-500">
          {creator?.display_name || creator?.username || "کاربر"}
          {video.duration_seconds ? ` · ${Math.floor(video.duration_seconds / 60)}:${String(video.duration_seconds % 60).padStart(2, "0")}` : ""}
          {` · ${video.views_count} بازدید`}
        </p>
      </section>
    </main>
  );
}