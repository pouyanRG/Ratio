import { fileTypeFromBuffer } from "file-type";

export type Mp4RangeReader = (start: number, end: number) => Promise<Uint8Array>;

type Mp4BoxHeader = {
  type: string;
  size: number;
  headerSize: number;
};

export async function isMp4Content(bytes: Uint8Array) {
  return (await fileTypeFromBuffer(bytes))?.mime === "video/mp4";
}

function readBoxHeader(bytes: Uint8Array, remainingBytes: number): Mp4BoxHeader | null {
  if (bytes.byteLength < 8) return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const size32 = view.getUint32(0);
  const type = String.fromCharCode(...bytes.subarray(4, 8));
  let size = size32;
  let headerSize = 8;

  if (size32 === 1) {
    if (bytes.byteLength < 16) return null;
    const extendedSize = view.getBigUint64(8);
    if (extendedSize > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    size = Number(extendedSize);
    headerSize = 16;
  } else if (size32 === 0) {
    size = remainingBytes;
  }

  if (size < headerSize || size > remainingBytes) return null;
  return { type, size, headerSize };
}

function readMvhdDuration(mvhd: Uint8Array): number | null {
  if (mvhd.byteLength < 8) return null;
  const header = readBoxHeader(mvhd, mvhd.byteLength);
  if (!header || header.type !== "mvhd") return null;

  const payload = mvhd.subarray(header.headerSize);
  if (payload.byteLength < 1) return null;
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const version = payload[0];
  let timescale: number;
  let duration: number;

  if (version === 0) {
    if (payload.byteLength < 20) return null;
    timescale = view.getUint32(12);
    duration = view.getUint32(16);
  } else if (version === 1) {
    if (payload.byteLength < 32) return null;
    timescale = view.getUint32(20);
    const duration64 = view.getBigUint64(24);
    if (duration64 > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    duration = Number(duration64);
  } else {
    return null;
  }

  if (timescale === 0 || duration === 0) return null;
  const seconds = duration / timescale;
  return Number.isFinite(seconds) ? seconds : null;
}

function readMoovDuration(moov: Uint8Array): number | null {
  const header = readBoxHeader(moov, moov.byteLength);
  if (!header || header.type !== "moov") return null;

  let offset = header.headerSize;
  while (offset + 8 <= header.size) {
    const child = readBoxHeader(moov.subarray(offset), header.size - offset);
    if (!child) return null;
    if (child.type === "mvhd") {
      return readMvhdDuration(moov.subarray(offset, offset + child.size));
    }
    offset += child.size;
  }
  return null;
}

export async function readMp4Duration(
  readRange: Mp4RangeReader,
  fileSize: number
): Promise<number | null> {
  if (!Number.isSafeInteger(fileSize) || fileSize < 8) return null;

  let offset = 0;
  while (offset + 8 <= fileSize) {
    const headerEnd = Math.min(fileSize - 1, offset + 15);
    const headerBytes = await readRange(offset, headerEnd);
    const header = readBoxHeader(headerBytes, fileSize - offset);
    if (!header) return null;

    if (header.type === "moov") {
      const moovEnd = offset + header.size - 1;
      const moov = await readRange(offset, moovEnd);
      if (moov.byteLength !== header.size) return null;
      return readMoovDuration(moov);
    }
    offset += header.size;
  }

  return null;
}