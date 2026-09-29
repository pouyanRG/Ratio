export type FeedVideo = {
  id: string;
  type: "reel" | "long";
  caption: string | null;
  created_at: string;
  duration_seconds: number | null;
  views_count: number;
  creator: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  thumbnailUrl: string | null;
};

export type FeedPage = {
  videos: FeedVideo[];
  nextCursor: string | null;
};

export async function fetchFeedPage(type: "reel" | "long" | null, cursor: string | null) {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (cursor) params.set("cursor", cursor);
  const response = await fetch(`/api/feed?${params.toString()}`, { cache: "no-store" });
  if (!response.ok) throw new Error("بارگذاری فید ناموفق بود.");
  return (await response.json()) as FeedPage;
}