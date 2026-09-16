import { get, put } from "@vercel/blob";
import { uid } from "@/lib/db/ids";
import type { StoredFile } from "@/lib/types";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_DATA_URL_CHARS = 1_400_000;
const BLOB_PREFIX = "romflow/";
const INLINE_IMAGE_PREFIX = "image/";

type BlobCallOptions = {
  access: "private";
  storeId?: string;
  token?: string;
};

function blobStoreId(): string | undefined {
  return process.env.ROMFLOWBLOB_STORE_ID || process.env.BLOB_STORE_ID;
}

function blobToken(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN || process.env.ROMFLOWBLOB_READ_WRITE_TOKEN;
}

function blobEnabled(): boolean {
  return Boolean(blobStoreId() || blobToken());
}

export function blobCallOptions(): BlobCallOptions {
  const storeId = blobStoreId();
  const token = blobToken();
  const options: BlobCallOptions = { access: "private" };
  if (storeId) {
    options.storeId = storeId;
  }
  const useOidc = Boolean(process.env.VERCEL_OIDC_TOKEN && storeId);
  if (!useOidc && token) {
    options.token = token;
  }
  return options;
}

function safeName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 80) || "arquivo";
}

export function fileProxyUrl(pathname: string): string {
  return `/api/files?pathname=${encodeURIComponent(pathname)}`;
}

function pathnameFromBlobUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith(".blob.vercel-storage.com")) {
      return null;
    }
    return decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  } catch {
    return null;
  }
}

function pathnameFromProxyUrl(url: string): string | null {
  if (!url.startsWith("/api/files")) {
    return null;
  }
  try {
    return new URL(url, "http://localhost").searchParams.get("pathname");
  } catch {
    return null;
  }
}

function isPrivateBlobUrl(url: string): boolean {
  try {
    return new URL(url).hostname.includes(".private.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export function storedPathname(file: StoredFile): string | null {
  if (file.pathname) {
    return file.pathname;
  }
  if (!file.url) {
    return null;
  }
  return pathnameFromProxyUrl(file.url) || pathnameFromBlobUrl(file.url);
}

export function assertSafeBlobPathname(pathname: string): string {
  const trimmed = pathname.trim();
  if (!trimmed || trimmed.length > 512) {
    throw new Error("Arquivo inválido.");
  }
  if (
    trimmed.includes("..") ||
    trimmed.includes("\\") ||
    trimmed.startsWith("/") ||
    trimmed.includes("://") ||
    /[%_?#]/.test(trimmed)
  ) {
    throw new Error("Arquivo inválido.");
  }
  if (!trimmed.startsWith(BLOB_PREFIX)) {
    throw new Error("Arquivo inválido.");
  }
  return trimmed;
}

function normalizedContentType(type: string): string {
  return type.split(";")[0].trim().toLowerCase();
}

function isSafeInlineContentType(type: string): boolean {
  if (type === "application/pdf") {
    return true;
  }
  return type.startsWith(INLINE_IMAGE_PREFIX) && type !== "image/svg+xml";
}

function storedContentType(type: string): string {
  const normalized = normalizedContentType(type);
  if (!normalized) {
    return "application/octet-stream";
  }
  if (normalized === "application/octet-stream" || isSafeInlineContentType(normalized)) {
    return normalized;
  }
  throw new Error("Envie um PDF ou uma imagem.");
}

export function blobDownloadHeaders(contentType: string | undefined, filename: string): HeadersInit {
  const type = normalizedContentType(contentType || "application/octet-stream") || "application/octet-stream";
  const inline = isSafeInlineContentType(type);
  return {
    "Content-Type": inline ? type : "application/octet-stream",
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "sandbox",
  };
}

export function storedFileGrantsPathname(file: StoredFile | null | undefined, pathname: string): boolean {
  if (!file) {
    return false;
  }
  if (file.pathname === pathname) {
    return true;
  }
  if (!file.url) {
    return false;
  }
  if (file.url === fileProxyUrl(pathname)) {
    return true;
  }
  return pathnameFromProxyUrl(file.url) === pathname || pathnameFromBlobUrl(file.url) === pathname;
}

function assertReusableStoredFile(file: StoredFile, actorId: string, existing?: StoredFile | null): void {
  const claimed = storedPathname(file);
  if (!claimed) {
    return;
  }
  const safe = assertSafeBlobPathname(claimed);
  if (safe.startsWith(`${BLOB_PREFIX}${actorId}/`)) {
    return;
  }
  const existingPath = existing ? storedPathname(existing) : null;
  if (existingPath === safe) {
    return;
  }
  throw new Error("Arquivo inválido.");
}

function storedFromBlob(file: { name: string; size: number; type: string }, blob: { pathname: string }): StoredFile {
  return {
    name: file.name,
    size: file.size,
    type: file.type,
    pathname: blob.pathname,
    url: fileProxyUrl(blob.pathname),
  };
}

export function publicStoredFile(file: StoredFile | null): StoredFile | null {
  if (!file) {
    return null;
  }
  const pathname = storedPathname(file);
  if (pathname && (file.pathname || isPrivateBlobUrl(file.url ?? "") || pathnameFromProxyUrl(file.url ?? ""))) {
    return {
      name: file.name,
      size: file.size,
      type: file.type,
      pathname,
      url: fileProxyUrl(pathname),
    };
  }
  if (file.url) {
    return {
      name: file.name,
      size: file.size,
      type: file.type,
      url: file.url,
    };
  }
  return file;
}

export async function persistStoredFile(
  file: StoredFile | null,
  folder: string,
  actorId: string,
  existing?: StoredFile | null,
): Promise<StoredFile | null> {
  if (!file) {
    return null;
  }
  if (file.pathname || file.url) {
    assertReusableStoredFile(file, actorId, existing);
    return publicStoredFile(file);
  }
  if (!file.dataUrl) {
    throw new Error("Arquivo inválido.");
  }
  const contentType = storedContentType(file.type);
  if (!blobEnabled()) {
    if (file.dataUrl.length > MAX_DATA_URL_CHARS) {
      throw new Error("Este arquivo está grande demais. Envie um PDF menor ou uma foto.");
    }
    return { ...file, type: contentType };
  }
  const comma = file.dataUrl.indexOf(",");
  const base64 = comma >= 0 ? file.dataUrl.slice(comma + 1) : file.dataUrl;
  const body = Buffer.from(base64, "base64");
  const blob = await put(`${BLOB_PREFIX}${folder}/${uid("file")}-${safeName(file.name)}`, body, {
    ...blobCallOptions(),
    addRandomSuffix: true,
    contentType,
  });
  return storedFromBlob({ name: file.name, size: file.size, type: contentType }, blob);
}

export async function persistUploadFile(file: File, folder: string): Promise<StoredFile> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("O arquivo deve ter no máximo 10 MB.");
  }
  const contentType = storedContentType(file.type);
  if (!blobEnabled()) {
    const buf = Buffer.from(await file.arrayBuffer());
    const dataUrl = `data:${contentType};base64,${buf.toString("base64")}`;
    if (dataUrl.length > MAX_DATA_URL_CHARS) {
      throw new Error("Este arquivo está grande demais. Envie um PDF menor ou uma foto.");
    }
    return {
      name: file.name,
      size: file.size,
      type: contentType,
      dataUrl,
    };
  }
  const blob = await put(`${BLOB_PREFIX}${folder}/${uid("file")}-${safeName(file.name)}`, file, {
    ...blobCallOptions(),
    addRandomSuffix: true,
    contentType,
  });
  return storedFromBlob({ name: file.name, size: file.size, type: contentType }, blob);
}

export async function streamPrivateBlob(pathname: string) {
  const result = await get(assertSafeBlobPathname(pathname), blobCallOptions());
  if (!result || result.statusCode !== 200 || !result.stream) {
    return null;
  }
  return result;
}
