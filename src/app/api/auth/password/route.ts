import { changeOwnPassword } from "@/lib/server/data";
import { errorStatus, jsonError, jsonOk, publicError, readJson } from "@/lib/server/http";
import { assertRequestLimit } from "@/lib/server/rate-limit";
import { ensureSeeded, requireUser } from "@/lib/server/session";

export async function POST(request: Request) {
  try {
    await ensureSeeded();
    const user = await requireUser();
    const body = await readJson<{ currentPassword?: string; password?: string }>(request);
    if (!body.currentPassword || !body.password) {
      return jsonError("Informe a senha atual e a nova senha.");
    }
    await assertRequestLimit(request, "change-password", user.id);
    await changeOwnPassword(user, body.currentPassword, body.password);
    return jsonOk({ ok: true });
  } catch (caught) {
    const message = publicError(caught);
    return jsonError(message, errorStatus(message));
  }
}
