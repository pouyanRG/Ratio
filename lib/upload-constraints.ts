export const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024;
export const VIDEO_CONTENT_TYPE = "video/mp4";

export function getVideoFileError(file: Pick<File, "size" | "type">) {
  if (file.type !== VIDEO_CONTENT_TYPE) {
    return "فقط فایل MP4 قابل آپلود است.";
  }

  if (file.size > MAX_VIDEO_SIZE_BYTES) {
    return "حجم ویدیو نباید بیشتر از ۵۰ مگابایت باشد.";
  }

  return null;
}