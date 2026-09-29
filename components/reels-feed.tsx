"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { VideoPlayer } from "@/components/video-player";
import { fetchFeedPage, type FeedVideo } from "@/lib/feed";

export function ReelsFeed() {
  const [videos, setVideos] = useState<FeedVideo[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const cards = useRef(new Map<string, HTMLElement>());
  const loadingMore = useRef(false);

  useEffect(() => {
    let mounted = true;
    void fetchFeedPage("reel", null)
      .then((page) => {
        if (!mounted) return;
        setVideos(page.videos);
        setCursor(page.nextCursor);
        setActiveId(page.videos[0]?.id ?? null);
      })
      .catch(() => {
        if (mounted) setError("دریافت ریلزها ناموفق بود.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!videos.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
        const id = visible?.target.getAttribute("data-video-id");
        const index = visible?.target.getAttribute("data-video-index");
        if (id && index) {
          setActiveId(id);
          setActiveIndex(Number(index));
        }
      },
      { threshold: [0.45, 0.65, 0.85] }
    );

    for (const node of cards.current.values()) observer.observe(node);
    return () => observer.disconnect();
  }, [videos]);

  useEffect(() => {
    if (!cursor || activeIndex < videos.length - 3 || loadingMore.current) return;
    loadingMore.current = true;
    void fetchFeedPage("reel", cursor)
      .then((page) => {
        setVideos((current) => [...current, ...page.videos]);
        setCursor(page.nextCursor);
      })
      .catch(() => {
        setError("بارگذاری ریلزهای بعدی ناموفق بود.");
      })
      .finally(() => {
        loadingMore.current = false;
      });
  }, [activeIndex, cursor, videos.length]);

  if (loading) {
    return <main className="grid min-h-dvh place-items-center">در حال بارگذاری…</main>;
  }
  if (!videos.length) {
    return <main className="grid min-h-dvh place-items-center">هنوز ریلزی منتشر نشده است.</main>;
  }

  return (
    <main className="h-[calc(100dvh-3.5rem)] snap-y snap-mandatory overflow-y-auto bg-black text-white">
      {error && <p className="fixed inset-x-0 top-3 z-20 text-center text-sm">{error}</p>}
      <ol>
        {videos.map((video, index) => (
          <li
            key={video.id}
            ref={(node) => {
              if (node) cards.current.set(video.id, node);
              else cards.current.delete(video.id);
            }}
            data-video-id={video.id}
            data-video-index={index}
            className="relative h-[calc(100dvh-3.5rem)] snap-start overflow-hidden"
          >
            <VideoPlayer
              videoId={video.id}
              title={video.caption || "ریلز"}
              posterUrl={video.thumbnailUrl}
              active={video.id === activeId}
              autoPlay
              className="absolute inset-0 h-full w-full"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 to-transparent px-5 pb-8 pt-24">
              <Link
                className="pointer-events-auto text-sm font-semibold"
                href={`/v/${video.id}`}
              >
                {video.creator?.display_name || video.creator?.username || "کاربر"}
              </Link>
              {video.caption && <p className="mt-2 max-w-lg text-sm">{video.caption}</p>}
              <p className="mt-2 text-xs text-white/70">{video.views_count} بازدید</p>
            </div>
          </li>
        ))}
      </ol>
    </main>
  );
}