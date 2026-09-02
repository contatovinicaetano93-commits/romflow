import { getSnapshot } from "@/lib/server/data";
import { ensureSeeded, requireUser } from "@/lib/server/session";
import { jsonError, jsonOk, publicError } from "@/lib/server/http";

export async function GET() {
  try {
    await ensureSeeded();
    const user = await requireUser();
    return jsonOk(await getSnapshot(user));
  } catch (caught) {
    const message = publicError(caught);
    return jsonError(message, message === "Sessão expirada." ? 401 : 400);
  }
}
