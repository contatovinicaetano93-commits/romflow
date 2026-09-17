import {
  assertSafeBlobPathname,
  blobDownloadHeaders,
  persistUploadFile,
  streamPrivateBlob,
} from "@/lib/server/blob";
import { userCanReadStoredPath } from "@/lib/server/data";
import { jsonError, jsonOk, publicError } from "@/lib/server/http";
import { assertRateLimit, clientKey } from "@/lib/server/rate-limit";
import { ensureSeeded, requireUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

function filenameFromPathname(pathname: string): string {
  const base = pathname.split("/").pop() || "arquivo";
  return base.replace(/["\\\r\n]/g, "_");
}

export async function GET(request: Request) {
  try {
    await ensureSeeded();
    const user = await requireUser();
    const pathname = assertSafeBlobPathname(new URL(request.url).searchParams.get("pathname") ?? "");
    if (!(await userCanReadStoredPath(user, pathname))) {
      return jsonError("Arquivo não encontrado.", 404);
    }
    const result = await streamPrivateBlob(pathname);
    if (!result) {
      return jsonError("Arquivo não encontrado.", 404);
    }
    return new Response(result.stream, {
      headers: blobDownloadHeaders(result.blob.contentType, filenameFromPathname(pathname)),
    });
  } catch (caught) {
    const message = publicError(caught);
    return jsonError(message, message === "Sessão expirada." ? 401 : 400);
  }
}

export async function POST(request: Request) {
  try {
    await ensureSeeded();
    const user = await requireUser();
    await assertRateLimit(clientKey(request, `upload:${user.id}`), undefined, 30);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return jsonError("Envie um arquivo.");
    }
    const stored = await persistUploadFile(file, user.id);
    return jsonOk({ file: stored });
  } catch (caught) {
    const message = publicError(caught);
    return jsonError(
      message,
      message === "Sessão expirada." ? 401 : message.startsWith("Muitas tentativas") ? 429 : 400,
    );
  }
}
