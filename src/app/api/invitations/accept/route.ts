import { acceptInvitation } from "@/lib/server/data";
import { ensureSeeded } from "@/lib/server/session";
import { jsonError, jsonOk, publicError, readJson } from "@/lib/server/http";
import { assertRateLimit, clientKey } from "@/lib/server/rate-limit";

export async function POST(request: Request) {
  try {
    await ensureSeeded();
    const body = await readJson<{ token?: string; name?: string; password?: string }>(request);
    if (!body.token || !body.name || !body.password) {
      return jsonError("Preencha nome e senha para ativar o acesso.");
    }
    assertRateLimit(clientKey(request, `accept:${body.token.slice(0, 12)}`));
    const user = await acceptInvitation(body.token, body.name, body.password);
    return jsonOk({ user });
  } catch (caught) {
    return jsonError(publicError(caught), 400);
  }
}
