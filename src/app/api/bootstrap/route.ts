import { bootstrapAdmin, getSnapshot } from "@/lib/server/data";
import { jsonError, jsonOk, publicError, readJson } from "@/lib/server/http";
import { ensureSeeded } from "@/lib/server/session";

export async function POST(request: Request) {
  try {
    await ensureSeeded();
    const body = await readJson<{ name?: string; email?: string; password?: string }>(request);
    if (!body.name || !body.email || !body.password) {
      return jsonError("Preencha nome, e-mail e senha.");
    }
    const user = await bootstrapAdmin(body.name, body.email, body.password);
    return jsonOk({ user, snapshot: await getSnapshot(user) });
  } catch (caught) {
    return jsonError(publicError(caught), 400);
  }
}
