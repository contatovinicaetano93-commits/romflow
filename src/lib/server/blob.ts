import { get, put } from "@vercel/blob";
import { uid } from "@/lib/db/ids";
import type { StoredFile } from "@/lib/types";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_DATA_URL_CHARS = 1_400_000;
const BLOB_PREFIX = "romflow/";

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

export async function persistStoredFile(file: StoredFile | null, folder: string): Promise<StoredFile | null> {
  if (!file) {
    return null;
  }
  if (file.pathname || file.url) {
    return publicStoredFile(file);
  }
  if (!file.dataUrl) {
    throw new Error("Arquivo inválido.");
  }
  if (!blobEnabled()) {
    if (file.dataUrl.length > MAX_DATA_URL_CHARS) {
      throw new Error("Este arquivo está grande demais. Envie um PDF menor ou uma foto.");
    }
    return file;
  }
  const comma = file.dataUrl.indexOf(",");
  const base64 = comma >= 0 ? file.dataUrl.slice(comma + 1) : file.dataUrl;
  const body = Buffer.from(base64, "base64");
  const contentType = file.type || "application/octet-stream";
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
  if (!blobEnabled()) {
    const buf = Buffer.from(await file.arrayBuffer());
    const dataUrl = `data:${file.type || "application/octet-stream"};base64,${buf.toString("base64")}`;
    if (dataUrl.length > MAX_DATA_URL_CHARS) {
      throw new Error("Este arquivo está grande demais. Envie um PDF menor ou uma foto.");
    }
    return {
      name: file.name,
      size: file.size,
      type: file.type,
      dataUrl,
    };
  }
  const contentType = file.type || "application/octet-stream";
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
