import { updateUserAccessRecord } from "@/lib/server/data";
import { ensureSeeded, requireAdmin } from "@/lib/server/session";
import { jsonError, jsonOk, publicError, readJson } from "@/lib/server/http";
import type { Role } from "@/lib/types";

export async function PATCH(request: Request) {
  try {
    await ensureSeeded();
    const actor = await requireAdmin();
    const body = await readJson<{ userId?: string; role?: Role; companyIds?: string[] }>(request);
    if (!body.userId || !body.role) {
      return jsonError("Informe o usuário e o perfil.");
    }
    const user = await updateUserAccessRecord(actor, body.userId, body.role, body.companyIds ?? []);
    return jsonOk({ user });
  } catch (caught) {
    const message = publicError(caught);
    return jsonError(message, message === "Sessão expirada." ? 401 : 400);
  }
}
