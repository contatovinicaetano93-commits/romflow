import { ensureSeeded } from "@/lib/server/session";
import { loginWithPassword } from "@/lib/server/data";
import { jsonError, jsonOk, publicError, readJson } from "@/lib/server/http";

export async function POST(request: Request) {
  try {
    await ensureSeeded();
    const body = await readJson<{ email?: string; password?: string }>(request);
    if (!body.email || !body.password) {
      return jsonError("Informe e-mail e senha.");
    }
    const user = await loginWithPassword(body.email, body.password);
    return jsonOk({ user });
  } catch (caught) {
    return jsonError(publicError(caught, "Failed to authenticate."), 401);
  }
}
