"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type VideoItem = {
  id: string;
  caption: string | null;
  created_at: string;
};

export default function SettingsPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadVideos() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error: listError } = await supabase
        .from("videos")
        .select("id, caption, created_at")
        .eq("user_id", user.id)
        .eq("status", "ready")
        .order("created_at", { ascending: false });
      if (!active) return;
      if (listError) {
        setError("بارگذاری ویدیوها ناموفق بود.");
        return;
      }
      setVideos(data ?? []);
    }

    void loadVideos();
    return () => {
      active = false;
    };
  }, []);

  async function signOut() {
    setError("");
    setLoading(true);
    const { error: signOutError } = await createClient().auth.signOut({
      scope: "local",
    });
    setLoading(false);
    if (signOutError) {
      setError(signOutError.message);
      return;
    }
    router.replace("/login");
    router.refresh();
  }

  async function deleteVideo(videoId: string) {
    if (!window.confirm("این ویدیو برای همیشه حذف شود؟")) return;
    setError("");
    setDeletingId(videoId);
    const response = await fetch(`/api/videos/${videoId}`, { method: "DELETE" });
    setDeletingId(null);
    if (!response.ok) {
      setError("حذف ویدیو ناموفق بود.");
      return;
    }
    setVideos((current) => current.filter((video) => video.id !== videoId));
  }

  return (
    <main className="mx-auto grid w-full max-w-xl content-start gap-5 px-6 py-10 text-right">
      <h1 className="text-2xl font-semibold">تنظیمات</h1>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <section className="grid gap-3">
        <h2 className="font-semibold">ویدیوهای من</h2>
        {videos.length === 0 && <p className="text-sm text-zinc-500">ویدیویی ندارید.</p>}
        <ul className="grid gap-2">
          {videos.map((video) => (
            <li
              className="flex items-center justify-between gap-4 border-b border-zinc-200 py-3 dark:border-zinc-800"
              key={video.id}
            >
              <span className="min-w-0 truncate">{video.caption || video.id}</span>
              <button
                className="shrink-0 rounded border border-red-300 px-3 py-2 text-sm text-red-700 disabled:opacity-50"
                onClick={() => void deleteVideo(video.id)}
                disabled={deletingId === video.id}
              >
                {deletingId === video.id ? "در حال حذف…" : "حذف"}
              </button>
            </li>
          ))}
        </ul>
      </section>
      <button
        className="w-fit rounded border border-zinc-300 px-4 py-3 disabled:opacity-50"
        onClick={signOut}
        disabled={loading}
      >
        {loading ? "در حال خروج…" : "خروج از حساب"}
      </button>
    </main>
  );
}