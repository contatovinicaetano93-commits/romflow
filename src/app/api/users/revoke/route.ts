import { revokeUserAccessRecord } from "@/lib/server/data";
import { ensureSeeded, requireAdmin } from "@/lib/server/session";
import { jsonError, jsonOk, publicError, readJson } from "@/lib/server/http";

export async function POST(request: Request) {
  try {
    await ensureSeeded();
    const user = await requireAdmin();
    const body = await readJson<{ userId?: string }>(request);
    if (!body.userId) {
      return jsonError("Usuário não informado.");
    }
    await revokeUserAccessRecord(user, body.userId);
    return jsonOk({ ok: true });
  } catch (caught) {
    const message = publicError(caught);
    return jsonError(message, message === "Sessão expirada." ? 401 : 400);
  }
}
