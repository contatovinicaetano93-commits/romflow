import { ensureSeeded } from "@/lib/server/session";
import { loginWithPassword } from "@/lib/server/data";
import { jsonError, jsonOk, publicError, readJson } from "@/lib/server/http";
import { assertRateLimit, clientKey } from "@/lib/server/rate-limit";

export async function POST(request: Request) {
  try {
    await ensureSeeded();
    const body = await readJson<{ email?: string; password?: string }>(request);
    if (!body.email || !body.password) {
      return jsonError("Informe e-mail e senha.");
    }
    assertRateLimit(clientKey(request, `login:${body.email}`));
    const user = await loginWithPassword(body.email, body.password);
    return jsonOk({ user });
  } catch (caught) {
    const message = publicError(caught, "Failed to authenticate.");
    const status = message.startsWith("Muitas tentativas") ? 429 : 401;
    return jsonError(message, status);
  }
}
