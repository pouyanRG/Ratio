"use client";
import Link from "next/link";
import { useState } from "react";
import { useUpload } from "@/hooks/useUpload";
import {
  getVideoFileError,
  VIDEO_CONTENT_TYPE,
} from "@/lib/upload-constraints";

export default function UploadPage() {
  const { start, progress, status, error, videoId } = useUpload();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [caption, setCaption] = useState("");

  return (
    <main className="mx-auto grid w-full max-w-xl content-start gap-5 px-6 py-10 text-right">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">آپلود ویدیو</h1>
        <Link className="text-sm text-zinc-500 underline" href="/settings">
          تنظیمات
        </Link>
      </div>
      <input
        type="file"
        accept={VIDEO_CONTENT_TYPE}
        onChange={(event) => {
          const selectedFile = event.target.files?.[0] ?? null;
          setFile(selectedFile);
          setFileError(selectedFile ? getVideoFileError(selectedFile) : null);
        }}
      />
      <p className="text-sm text-zinc-500">فقط MP4، حداکثر ۵۰ مگابایت</p>
      <p className="text-sm text-zinc-500">ویدیوهای حداکثر ۹۰ ثانیه به‌صورت ریلز منتشر می‌شوند.</p>
      {fileError && <p role="alert" className="text-sm text-red-600">{fileError}</p>}
      <textarea
        className="min-h-28 rounded border border-zinc-300 bg-transparent p-3"
        placeholder="کپشن"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
      />
      <button
        className="rounded bg-zinc-900 px-4 py-3 text-white disabled:opacity-50 dark:bg-white dark:text-black"
        disabled={!file || !!fileError || status === "uploading" || status === "finalizing"}
        onClick={() => file && start(file, { caption })}
      >
        شروع آپلود
      </button>

      {status === "uploading" && <progress aria-label="پیشرفت آپلود" value={progress} max={100} />}
      {status === "finalizing" && <p>در حال نهایی‌سازی…</p>}
      {status === "ready" && <p>آماده شد ✅ (id: {videoId})</p>}
      {status === "failed" && <p role="alert" className="text-red-600">خطا: {error}</p>}
    </main>
  );
}
