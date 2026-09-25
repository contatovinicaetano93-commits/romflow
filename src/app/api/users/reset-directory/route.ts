import { resetAccessDirectoryRecord } from "@/lib/server/data";
import { ensureSeeded, requireMaster } from "@/lib/server/session";
import { jsonError, jsonOk, publicError } from "@/lib/server/http";

export async function POST() {
  try {
    await ensureSeeded();
    const actor = await requireMaster();
    const result = await resetAccessDirectoryRecord(actor);
    return jsonOk({ ok: true, users: result.users, removed: result.removed, invitations: [] });
  } catch (caught) {
    const message = publicError(caught);
    return jsonError(message, message === "Sessão expirada." ? 401 : 400);
  }
}
