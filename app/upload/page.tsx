"use client";
import Link from "next/link";
import { useRef, useState } from "react";
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
  const [isDragging, setIsDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const isBusy = status === "uploading" || status === "finalizing";

  function selectFile(selectedFile: File | null) {
    setFile(selectedFile);
    setFileError(selectedFile ? getVideoFileError(selectedFile) : null);
  }

  return (
    <main className="upload-page" dir="rtl">
      <header className="upload-topbar">
        <Link className="upload-wordmark" href="/" aria-label="Ratio، صفحه اصلی">
          ratio<span>.</span>
        </Link>
        <nav aria-label="ناوبری اصلی">
          <Link className="upload-settings-link" href="/settings">تنظیمات</Link>
        </nav>
      </header>

      <div className="upload-content">
        <div className="upload-heading">
          <p className="upload-kicker">انتشار در Ratio</p>
          <h1>ویدیوی تازه‌ات را منتشر کن</h1>
          <p>فایل را انتخاب کن، کپشن را بنویس و آمادهٔ انتشار شو.</p>
        </div>

        <div className="upload-layout">
          <section className="upload-form-panel" aria-labelledby="upload-form-title">
            <h2 id="upload-form-title">جزئیات ویدیو</h2>

            <div
              className={`upload-dropzone${isDragging ? " is-dragging" : ""}${file ? " has-file" : ""}`}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setIsDragging(false);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                selectFile(event.dataTransfer.files[0] ?? null);
              }}
            >
              <input
                ref={fileInput}
                className="upload-file-input"
                type="file"
                accept={VIDEO_CONTENT_TYPE}
                aria-label="انتخاب فایل ویدیو"
                disabled={isBusy}
                onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
              />
              <span className="upload-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14.5v3A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5v-3" />
                </svg>
              </span>
              {file ? (
                <>
                  <strong className="upload-file-name">{file.name}</strong>
                  <span className="upload-file-meta">
                    {new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(file.size / 1024 / 1024)} مگابایت
                  </span>
                  <button
                    className="upload-change-file"
                    type="button"
                    disabled={isBusy}
                    onClick={() => fileInput.current?.click()}
                  >
                    تغییر فایل
                  </button>
                </>
              ) : (
                <>
                  <strong>فایل ویدیو را اینجا رها کن</strong>
                  <span className="upload-file-meta">یا از دستگاهت انتخاب کن</span>
                  <span className="upload-choose-button">انتخاب فایل</span>
                </>
              )}
            </div>
            {fileError && <p className="upload-error" role="alert">{fileError}</p>}

            <label className="upload-field-label" htmlFor="video-caption">کپشن</label>
            <textarea
              id="video-caption"
              className="upload-caption"
              placeholder="برای ویدیوت کپشن بنویس..."
              maxLength={2200}
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
            />
            <div className="upload-caption-footer">
              <span>حداکثر ۲۲۰۰ نویسه</span>
              <span>{new Intl.NumberFormat("fa-IR").format(caption.length)} / ۲۲۰۰</span>
            </div>

            {status === "uploading" && (
              <div className="upload-progress" aria-live="polite">
                <div className="upload-progress-label">
                  <span>در حال بارگذاری</span>
                  <span>{new Intl.NumberFormat("fa-IR").format(progress)}٪</span>
                </div>
                <div
                  className="upload-progress-track"
                  role="progressbar"
                  aria-label="پیشرفت بارگذاری"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                >
                  <span style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            {status === "finalizing" && (
              <p className="upload-status" role="status">در حال بررسی و آماده‌سازی ویدیو...</p>
            )}
            {status === "ready" && (
              <p className="upload-success" role="status">
                ویدیوت با موفقیت آماده شد.
                {videoId && <Link href={`/v/${videoId}`}>مشاهده ویدیو</Link>}
              </p>
            )}
            {status === "failed" && <p className="upload-error" role="alert">{error}</p>}

            <button
              className="upload-submit"
              type="button"
              disabled={!file || !!fileError || isBusy}
              onClick={() => file && start(file, { caption })}
            >
              {status === "uploading" ? "در حال بارگذاری..." : status === "finalizing" ? "در حال آماده‌سازی..." : "شروع بارگذاری"}
            </button>
          </section>

          <aside className="upload-guidance" aria-labelledby="upload-guidance-title">
            <h2 id="upload-guidance-title">پیش از بارگذاری</h2>
            <ul>
              <li><span>فرمت فایل</span><strong>MP4</strong></li>
              <li><span>حداکثر حجم</span><strong>۵۰ مگابایت</strong></li>
              <li><span>ویدیوی کوتاه</span><strong>تا ۹۰ ثانیه</strong></li>
            </ul>
            <p>ویدیوهای کوتاه به‌صورت ریلز منتشر می‌شوند. زمان ویدیو پس از بارگذاری بررسی خواهد شد.</p>
          </aside>
        </div>
      </div>
    </main>
  );
}
