// File storage for cached factsheet PDFs and generated reports.
//
// Two drivers, chosen with STORAGE_DRIVER:
//   local  PDFs are written under LOCAL_STORAGE_DIR (default ./local-data/storage)
//   s3     PDFs are written to any S3-compatible bucket (AWS S3, Cloudflare R2,
//          MinIO, DigitalOcean Spaces) using S3_* settings
//
// Stored files are always exposed to the browser as /files/<key>. That route
// checks the session before serving (see server/_core/fileRoutes.ts), so cached
// PDFs are never public on a team server.

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ENV } from "./_core/env";

export const FILE_ROUTE_PREFIX = "/files/";

function normalizeKey(relKey: string): string {
  const key = relKey.replace(/^\/+/, "").replace(/\\/g, "/");
  if (!key || key.split("/").some((segment) => segment === ".." || segment === ".")) throw new Error("Invalid storage key");
  return key;
}

export function getLocalStorageDirectory() {
  return path.resolve(process.env.LOCAL_STORAGE_DIR ?? path.join(process.cwd(), "local-data", "storage"));
}

function localStoragePath(key: string) {
  const root = getLocalStorageDirectory();
  const target = path.resolve(root, key);
  if (!target.startsWith(`${root}${path.sep}`)) throw new Error("Invalid local storage path");
  return target;
}

/** Public app path for a stored key, e.g. /files/factsheets/hdfc/july_ab12cd34.pdf */
export function fileRouteUrl(key: string) {
  return `${FILE_ROUTE_PREFIX}${normalizeKey(key).split("/").map(encodeURIComponent).join("/")}`;
}

/** Reverse of fileRouteUrl. Returns undefined for anything that is not one of our /files/ paths. */
export function keyFromFileRouteUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  let pathname = url;
  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);
      if (parsed.origin !== new URL(ENV.localAppOrigin).origin) return undefined;
      pathname = parsed.pathname;
    } catch {
      return undefined;
    }
  }
  if (!pathname.startsWith(FILE_ROUTE_PREFIX)) return undefined;
  try {
    return normalizeKey(pathname.slice(FILE_ROUTE_PREFIX.length).split("/").map(decodeURIComponent).join("/"));
  } catch {
    return undefined;
  }
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

let s3Client: S3Client | undefined;
function getS3() {
  if (!ENV.s3Bucket) throw new Error("Storage config missing: set S3_BUCKET (and S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY) when STORAGE_DRIVER=s3");
  if (!s3Client) {
    s3Client = new S3Client({
      region: ENV.s3Region,
      ...(ENV.s3Endpoint ? { endpoint: ENV.s3Endpoint } : {}),
      forcePathStyle: ENV.s3ForcePathStyle,
      ...(ENV.s3AccessKeyId && ENV.s3SecretAccessKey
        ? { credentials: { accessKeyId: ENV.s3AccessKeyId, secretAccessKey: ENV.s3SecretAccessKey } }
        : {}),
    });
  }
  return { client: s3Client, bucket: ENV.s3Bucket };
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  if (ENV.storageDriver === "s3") {
    const { client, bucket } = getS3();
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: typeof data === "string" ? Buffer.from(data) : data, ContentType: contentType }));
  } else {
    const target = localStoragePath(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
  }
  return { key, url: fileRouteUrl(key) };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: fileRouteUrl(key) };
}

/** Read a stored object straight into memory (server-side parsing, AI attachments). */
export async function storageRead(relKey: string): Promise<Buffer> {
  const key = normalizeKey(relKey);
  if (ENV.storageDriver === "s3") {
    const { client, bucket } = getS3();
    const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!result.Body) throw new Error(`Stored file is empty: ${key}`);
    return Buffer.from(await result.Body.transformToByteArray());
  }
  return readFile(localStoragePath(key));
}

/** A short-lived direct S3 link, or the local file path for the local driver. */
export async function storageDirectLocation(relKey: string): Promise<{ kind: "redirect"; url: string } | { kind: "file"; path: string }> {
  const key = normalizeKey(relKey);
  if (ENV.storageDriver === "s3") {
    const { client, bucket } = getS3();
    return { kind: "redirect", url: await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 300 }) };
  }
  return { kind: "file", path: localStoragePath(key) };
}

/**
 * URL used by the server's own PDF readers. Kept for call-site compatibility:
 * it now returns the internal /files/ path, which pdfPageCache and the AI
 * client resolve directly through storageRead (no HTTP round trip).
 */
export async function storageGetSignedUrl(relKey: string): Promise<string> {
  return fileRouteUrl(relKey);
}

/** Fetch PDF bytes for one of our /files/ URLs, or an external https URL. */
export async function readPdfBytes(url: string): Promise<Uint8Array> {
  const key = keyFromFileRouteUrl(url);
  if (key) return new Uint8Array(await storageRead(key));
  const response = await fetch(url);
  if (!response.ok) throw new Error(`PDF request failed with ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}
