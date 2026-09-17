import { getSnapshotSafe, loginWithPassword } from "@/lib/server/data";
import { jsonError, jsonOk, publicError, readJson } from "@/lib/server/http";
import { assertRateLimit, clientKey } from "@/lib/server/rate-limit";
import { ensureSeeded } from "@/lib/server/session";

export async function POST(request: Request) {
  try {
    await ensureSeeded();
    const body = await readJson<{ email?: string; password?: string }>(request);
    if (!body.email || !body.password) {
      return jsonError("Informe e-mail e senha.");
    }
    await assertRateLimit(clientKey(request, "login"), undefined, 20);
    await assertRateLimit(clientKey(request, `login:${body.email}`));
    const user = await loginWithPassword(body.email, body.password);
    return jsonOk({ user, snapshot: await getSnapshotSafe(user) });
  } catch (caught) {
    const message = publicError(caught, "E-mail ou senha incorretos.");
    const status = message.startsWith("Muitas tentativas") ? 429 : 401;
    return jsonError(message, status);
  }
}
