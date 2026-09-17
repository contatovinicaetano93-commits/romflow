import { getSnapshotSafe } from "@/lib/server/data";
import { ensureSeeded, requireUser } from "@/lib/server/session";
import { jsonError, jsonOk, publicError } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSeeded();
    const user = await requireUser();
    const snapshot = await getSnapshotSafe(user);
    if (!snapshot) {
      return jsonOk(
        {
          revision: 1,
          companies: [],
          categories: [],
          users: [user],
          invitations: [],
          expenses: [],
          auditLogs: [],
          emailLogs: [],
        },
        200,
        { "Cache-Control": "no-store, max-age=0" },
      );
    }
    return jsonOk(snapshot, 200, { "Cache-Control": "no-store, max-age=0" });
  } catch (caught) {
    const message = publicError(caught);
    return jsonError(message, message === "Sessão expirada." ? 401 : 400);
  }
}
