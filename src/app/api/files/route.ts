import { persistUploadFile } from "@/lib/server/blob";
import { jsonError, jsonOk, publicError } from "@/lib/server/http";
import { ensureSeeded, requireUser } from "@/lib/server/session";

export async function POST(request: Request) {
  try {
    await ensureSeeded();
    const user = await requireUser();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return jsonError("Envie um arquivo.");
    }
    const stored = await persistUploadFile(file, user.id);
    return jsonOk({ file: stored });
  } catch (caught) {
    const message = publicError(caught);
    return jsonError(message, message === "Sessão expirada." ? 401 : 400);
  }
}
