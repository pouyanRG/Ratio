import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const BUCKET = process.env.DOSYA_BUCKET!;

export const dosya = new S3Client({
  region: process.env.DOSYA_REGION!,
  endpoint: process.env.DOSYA_ENDPOINT!,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.DOSYA_ACCESS_KEY!,
    secretAccessKey: process.env.DOSYA_SECRET_KEY!,
  },
});

const URL_EXPIRES = 3600;

export function dosyaVideoKey(videoId: string) {
  return `videos/${videoId}/original.mp4`;
}

export function dosyaThumbKey(videoId: string) {
  return `videos/${videoId}/thumb.jpg`;
}

export async function dosyaPresignUpload(key: string, contentType: string) {
  return getSignedUrl(
    dosya,
    new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: URL_EXPIRES }
  );
}

export async function dosyaPresignRead(key: string) {
  return getSignedUrl(
    dosya,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn: URL_EXPIRES }
  );
}

export async function dosyaObjectExists(key: string) {
  try {
    await dosya.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}