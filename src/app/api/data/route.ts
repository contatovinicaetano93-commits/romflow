import { getSnapshot } from "@/lib/server/data";
import { ensureSeeded, requireUser } from "@/lib/server/session";
import { jsonError, jsonOk, publicError } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSeeded();
    const user = await requireUser();
    return jsonOk(await getSnapshot(user), 200, { "Cache-Control": "no-store, max-age=0" });
  } catch (caught) {
    const message = publicError(caught);
    return jsonError(message, message === "Sessão expirada." ? 401 : 400);
  }
}
