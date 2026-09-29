import { describe, expect, it } from "vitest";
import { isMp4Content, readMp4Duration } from "@/lib/media-validation";
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

  it("reads mvhd duration when moov is at the end of the file", async () => {
    const makeBox = (type: string, payload: Buffer) => {
      const header = Buffer.alloc(8);
      header.writeUInt32BE(header.byteLength + payload.byteLength, 0);
      header.write(type, 4);
      return Buffer.concat([header, payload]);
    };
    const ftyp = makeBox("ftyp", Buffer.from("isom0000"));
    const mdat = makeBox("mdat", Buffer.alloc(256));
    const mvhdPayload = Buffer.alloc(20);
    mvhdPayload.writeUInt32BE(1000, 12);
    mvhdPayload.writeUInt32BE(93500, 16);
    const moov = makeBox("moov", makeBox("mvhd", mvhdPayload));
    const file = Buffer.concat([ftyp, mdat, moov]);
    const ranges: Array<[number, number]> = [];

    const duration = await readMp4Duration(async (start, end) => {
      ranges.push([start, end]);
      return new Uint8Array(file.subarray(start, end + 1));
    }, file.byteLength);

    expect(duration).toBe(93.5);
    expect(ranges.some(([start]) => start === ftyp.byteLength + mdat.byteLength)).toBe(true);
  });
});