import { assertPasswordResetToken, getSnapshotSafe, resetPasswordWithToken } from "@/lib/server/data";
import { jsonError, jsonOk, publicError, readJson } from "@/lib/server/http";
import { assertRateLimit, clientKey } from "@/lib/server/rate-limit";
import { ensureSeeded } from "@/lib/server/session";

export async function GET(request: Request) {
  try {
    await ensureSeeded();
    const token = new URL(request.url).searchParams.get("token") ?? "";
    if (!token) {
      return jsonError("Link inválido ou expirado. Solicite uma nova redefinição de senha.");
    }
    await assertRateLimit(clientKey(request, `reset:${token.slice(0, 12)}`));
    await assertPasswordResetToken(token);
    return jsonOk({ ok: true });
  } catch (caught) {
    return jsonError(publicError(caught), 400);
  }
}

export async function POST(request: Request) {
  try {
    await ensureSeeded();
    const body = await readJson<{ token?: string; password?: string }>(request);
    if (!body.token || !body.password) {
      return jsonError("Informe a nova senha.");
    }
    await assertRateLimit(clientKey(request, `reset:${body.token.slice(0, 12)}`));
    const user = await resetPasswordWithToken(body.token, body.password);
    return jsonOk({ user, snapshot: await getSnapshotSafe(user) });
  } catch (caught) {
    const message = publicError(caught);
    return jsonError(message, message.startsWith("Muitas tentativas") ? 429 : 400);
  }
}
