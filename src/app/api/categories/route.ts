import { createCategoryRecord, updateCategoryRecord } from "@/lib/server/data";
import { ensureSeeded, requireAdmin } from "@/lib/server/session";
import { jsonError, jsonOk, publicError, readJson } from "@/lib/server/http";
import type { Category } from "@/lib/types";

export async function POST(request: Request) {
  try {
    await ensureSeeded();
    await requireAdmin();
    const body = await readJson<{ name?: string; color?: string }>(request);
    if (!body.name || !body.color) {
      return jsonError("Informe nome e cor.");
    }
    const category = await createCategoryRecord({ name: body.name, color: body.color });
    return jsonOk({ category });
  } catch (caught) {
    const message = publicError(caught);
    return jsonError(message, message === "Sessão expirada." ? 401 : 400);
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureSeeded();
    await requireAdmin();
    const body = await readJson<{ id?: string; patch?: Partial<Category> }>(request);
    if (!body.id || !body.patch) {
      return jsonError("Informe a categoria.");
    }
    await updateCategoryRecord(body.id, body.patch);
    return jsonOk({ ok: true });
  } catch (caught) {
    const message = publicError(caught);
    return jsonError(message, message === "Sessão expirada." ? 401 : 400);
  }
}
