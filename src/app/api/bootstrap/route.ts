import { bootstrapAdmin, getSnapshotSafe } from "@/lib/server/data";
import { jsonError, jsonOk, publicError, readJson } from "@/lib/server/http";
import { assertRateLimit, clientKey } from "@/lib/server/rate-limit";
import { ensureSeeded } from "@/lib/server/session";

export async function POST(request: Request) {
  try {
    await ensureSeeded();
    await assertRateLimit(clientKey(request, "bootstrap"), undefined, 20);
    const body = await readJson<{ name?: string; email?: string; password?: string }>(request);
    if (!body.name || !body.email || !body.password) {
      return jsonError("Preencha nome, e-mail e senha.");
    }
    const user = await bootstrapAdmin(body.name, body.email, body.password);
    return jsonOk({ user, snapshot: await getSnapshotSafe(user) });
  } catch (caught) {
    const message = publicError(caught);
    return jsonError(message, message.startsWith("Muitas tentativas") ? 429 : 400);
  }
}
