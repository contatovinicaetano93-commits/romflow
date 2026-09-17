import { createCompanyRecord, updateCompanyStatusRecord } from "@/lib/server/data";
import { ensureSeeded, requireAdmin } from "@/lib/server/session";
import { jsonError, jsonOk, publicError, readJson } from "@/lib/server/http";

export async function POST(request: Request) {
  try {
    await ensureSeeded();
    const actor = await requireAdmin();
    const body = await readJson<{ name?: string; color?: string }>(request);
    if (!body.name || !body.color) {
      return jsonError("Informe nome e cor.");
    }
    const company = await createCompanyRecord(actor, { name: body.name, color: body.color });
    return jsonOk({ company });
  } catch (caught) {
    const message = publicError(caught);
    return jsonError(message, message === "Sessão expirada." ? 401 : 400);
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureSeeded();
    const actor = await requireAdmin();
    const body = await readJson<{ companyId?: string; isActive?: boolean }>(request);
    if (!body.companyId || typeof body.isActive !== "boolean") {
      return jsonError("Informe a empresa e o status.");
    }
    const company = await updateCompanyStatusRecord(actor, body.companyId, body.isActive);
    return jsonOk({ company });
  } catch (caught) {
    const message = publicError(caught);
    return jsonError(message, message === "Sessão expirada." ? 401 : 400);
  }
}
