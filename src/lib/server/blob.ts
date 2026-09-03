import { put } from "@vercel/blob";
import { uid } from "@/lib/db/ids";
import type { StoredFile } from "@/lib/types";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_DATA_URL_CHARS = 1_400_000;

function blobEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function safeName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 80) || "arquivo";
}

export function publicStoredFile(file: StoredFile | null): StoredFile | null {
  if (!file) {
    return null;
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
  if (file.url) {
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
  const blob = await put(`romflow/${folder}/${uid("file")}-${safeName(file.name)}`, body, {
    access: "public",
    addRandomSuffix: true,
    contentType,
  });
  return {
    name: file.name,
    size: file.size,
    type: contentType,
    url: blob.url,
  };
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
  const blob = await put(`romflow/${folder}/${uid("file")}-${safeName(file.name)}`, file, {
    access: "public",
    addRandomSuffix: true,
    contentType,
  });
  return {
    name: file.name,
    size: file.size,
    type: contentType,
    url: blob.url,
  };
}
