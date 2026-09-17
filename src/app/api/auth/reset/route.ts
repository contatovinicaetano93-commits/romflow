import { assertPasswordResetToken, getSnapshotSafe, resetPasswordWithToken } from "@/lib/server/data";
import { errorStatus, jsonError, jsonOk, publicError, readJson } from "@/lib/server/http";
import { assertRequestLimit } from "@/lib/server/rate-limit";
import { ensureSeeded } from "@/lib/server/session";

export async function GET(request: Request) {
  try {
    await ensureSeeded();
    const token = new URL(request.url).searchParams.get("token") ?? "";
    if (!token) {
      return jsonError("Link inválido ou expirado. Solicite uma nova redefinição de senha.");
    }
    await assertRequestLimit(request, "reset", token.slice(0, 12));
    await assertPasswordResetToken(token);
    return jsonOk({ ok: true });
  } catch (caught) {
    const message = publicError(caught);
    return jsonError(message, errorStatus(message));
  }
}

export async function POST(request: Request) {
  try {
    await ensureSeeded();
    const body = await readJson<{ token?: string; password?: string }>(request);
    if (!body.token || !body.password) {
      return jsonError("Informe a nova senha.");
    }
    await assertRequestLimit(request, "reset", body.token.slice(0, 12));
    const user = await resetPasswordWithToken(body.token, body.password);
    return jsonOk({ user, snapshot: await getSnapshotSafe(user) });
  } catch (caught) {
    const message = publicError(caught);
    return jsonError(message, errorStatus(message));
  }
}
