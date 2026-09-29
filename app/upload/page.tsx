"use client";
import { useState } from "react";
import { useUpload } from "@/hooks/useUpload";

export default function UploadPage() {
  const { start, progress, status, error, videoId } = useUpload();
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<"reel" | "long">("reel");
  const [caption, setCaption] = useState("");

  return (
    <main
      dir="rtl"
      style={{
        maxWidth: 480,
        margin: "0 auto",
        padding: 24,
        display: "grid",
        gap: 12,
      }}
    >
      <h1>آپلود ویدیو</h1>
      <input
        type="file"
        accept="video/*"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <select
        value={type}
        onChange={(e) => setType(e.target.value as "reel" | "long")}
      >
        <option value="reel">ریلز</option>
        <option value="long">ویدیوی بلند</option>
      </select>
      <textarea
        placeholder="کپشن"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
      />
      <button
        disabled={!file || status === "uploading" || status === "finalizing"}
        onClick={() => file && start(file, { type, caption })}
      >
        شروع آپلود
      </button>

      {status === "uploading" && <progress value={progress} max={100} />}
      {status === "finalizing" && <p>در حال نهایی‌سازی…</p>}
      {status === "ready" && <p>آماده شد ✅ (id: {videoId})</p>}
      {status === "failed" && <p style={{ color: "#ff2d55" }}>خطا: {error}</p>}
    </main>
  );
}
