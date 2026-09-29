import { describe, expect, it } from "vitest";
import { isMp4Content } from "@/lib/media-validation";
import {
  getVideoFileError,
  MAX_VIDEO_SIZE_BYTES,
} from "@/lib/upload-constraints";

describe("upload limits", () => {
  it("accepts exactly 50 MiB and rejects larger or non-MP4 files", () => {
    expect(getVideoFileError({ size: MAX_VIDEO_SIZE_BYTES, type: "video/mp4" })).toBeNull();
    expect(getVideoFileError({ size: MAX_VIDEO_SIZE_BYTES + 1, type: "video/mp4" })).not.toBeNull();
    expect(getVideoFileError({ size: 10, type: "image/png" })).not.toBeNull();
  });

  it("detects MP4 signatures rather than trusting a MIME label", async () => {
    const header = Buffer.alloc(32);
    header.writeUInt32BE(24, 0);
    header.write("ftyp", 4);
    header.write("isom", 8);
    expect(await isMp4Content(header)).toBe(true);
    expect(await isMp4Content(Buffer.from("not a video file"))).toBe(false);
  });
});