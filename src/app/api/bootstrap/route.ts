import { bootstrapAdmin, getBootstrapSnapshotSafe } from "@/lib/server/data";
import { errorStatus, jsonError, jsonOk, publicError, readJson } from "@/lib/server/http";
import { assertRequestLimit } from "@/lib/server/rate-limit";
import { ensureSeeded } from "@/lib/server/session";

export async function POST(request: Request) {
  try {
    await ensureSeeded();
    await assertRequestLimit(request, "bootstrap");
    const body = await readJson<{ name?: string; email?: string; password?: string }>(request);
    if (!body.name || !body.email || !body.password) {
      return jsonError("Preencha nome, e-mail e senha.");
    }
    const user = await bootstrapAdmin(body.name, body.email, body.password);
    return jsonOk({ user, snapshot: await getBootstrapSnapshotSafe(user) });
  } catch (caught) {
    const message = publicError(caught);
    return jsonError(message, errorStatus(message));
  }
}
