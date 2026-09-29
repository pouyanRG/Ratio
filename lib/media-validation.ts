import { fileTypeFromBuffer } from "file-type";

export async function isMp4Content(bytes: Uint8Array) {
  return (await fileTypeFromBuffer(bytes))?.mime === "video/mp4";
}