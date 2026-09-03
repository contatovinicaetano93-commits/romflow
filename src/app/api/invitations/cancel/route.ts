import { cancelInvitationRecord } from "@/lib/server/data";
import { ensureSeeded, requireAdmin } from "@/lib/server/session";
import { jsonError, jsonOk, publicError, readJson } from "@/lib/server/http";

export async function POST(request: Request) {
  try {
    await ensureSeeded();
    const user = await requireAdmin();
    const body = await readJson<{ invitationId?: string }>(request);
    if (!body.invitationId) {
      return jsonError("Informe o convite.");
    }
    await cancelInvitationRecord(user, body.invitationId);
    return jsonOk({ ok: true });
  } catch (caught) {
    const message = publicError(caught);
    return jsonError(message, message === "Sessão expirada." ? 401 : 400);
  }
}
