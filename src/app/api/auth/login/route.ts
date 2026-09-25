import { getBootstrapSnapshotSafe, loginWithPassword } from "@/lib/server/data";
import { errorStatus, jsonError, jsonOk, publicError, readJson } from "@/lib/server/http";
import { assertRequestLimit } from "@/lib/server/rate-limit";
import { ensureSeeded } from "@/lib/server/session";

export async function POST(request: Request) {
  try {
    await ensureSeeded();
    const body = await readJson<{ email?: string; password?: string }>(request);
    if (!body.email || !body.password) {
      return jsonError("Informe e-mail e senha.");
    }
    await assertRequestLimit(request, "login", body.email);
    const user = await loginWithPassword(body.email, body.password);
    return jsonOk({ user, snapshot: await getBootstrapSnapshotSafe(user) });
  } catch (caught) {
    const message = publicError(caught, "E-mail ou senha incorretos.");
    return jsonError(message, errorStatus(message, 401));
  }
}
