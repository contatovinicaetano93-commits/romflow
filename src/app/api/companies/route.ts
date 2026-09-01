import { createCompanyRecord } from "@/lib/server/data";
import { ensureSeeded, requireAdmin } from "@/lib/server/session";
import { jsonError, jsonOk, publicError, readJson } from "@/lib/server/http";

export async function POST(request: Request) {
  try {
    await ensureSeeded();
    await requireAdmin();
    const body = await readJson<{ name?: string; color?: string }>(request);
    if (!body.name || !body.color) {
      return jsonError("Informe nome e cor.");
    }
    const company = await createCompanyRecord({ name: body.name, color: body.color });
    return jsonOk({ company });
  } catch (caught) {
    const message = publicError(caught);
    return jsonError(message, message === "Sessão expirada." ? 401 : 400);
  }
}
