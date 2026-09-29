"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchFeedPage, type FeedVideo } from "@/lib/feed";

export function FeedGrid() {
  const [videos, setVideos] = useState<FeedVideo[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    void fetchFeedPage(null, null)
      .then((page) => {
        if (!mounted) return;
        setVideos(page.videos);
        setCursor(page.nextCursor);
      })
      .catch(() => {
        if (mounted) setError("بارگذاری فید ناموفق بود.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const page = await fetchFeedPage(null, cursor);
      setVideos((current) => [...current, ...page.videos]);
      setCursor(page.nextCursor);
    } catch {
      setError("بارگذاری ویدیوهای بعدی ناموفق بود.");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <main className="mx-auto grid w-full max-w-6xl content-start gap-6 px-4 py-6 md:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-zinc-500">Ratio</p>
          <h1 className="text-2xl font-semibold">ویدیوهای تازه</h1>
        </div>
      </header>

      {loading && <p className="py-12 text-center text-zinc-500">در حال بارگذاری…</p>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {!loading && videos.length === 0 && (
        <p className="py-12 text-center text-zinc-500">هنوز ویدیویی منتشر نشده است.</p>
      )}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {videos.map((video) => (
          <li key={video.id}>
            <Link className="group block" href={video.type === "reel" ? "/reels" : `/v/${video.id}`}>
              <div className="relative aspect-[3/4] overflow-hidden rounded bg-zinc-200 dark:bg-zinc-900">
                {video.thumbnailUrl ? (
                  <Image
                    className="object-cover transition-transform group-hover:scale-[1.02]"
                    src={video.thumbnailUrl}
                    alt={video.caption || "ویدیو"}
                    fill
                    unoptimized
                    sizes="(max-width: 640px) 50vw, 25vw"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-sm text-zinc-500">ویدیو</div>
                )}
              </div>
              <p className="mt-2 truncate text-sm font-medium">{video.caption || "بدون کپشن"}</p>
              <p className="mt-1 truncate text-xs text-zinc-500">
                {video.creator?.display_name || video.creator?.username || "کاربر"}
                {` · ${video.views_count} بازدید`}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      {cursor && (
        <button
          className="mx-auto rounded border border-zinc-300 px-5 py-3 disabled:opacity-50"
          onClick={() => void loadMore()}
          disabled={loadingMore}
        >
          {loadingMore ? "در حال بارگذاری…" : "ویدیوهای بیشتر"}
        </button>
      )}
    </main>
  );
}