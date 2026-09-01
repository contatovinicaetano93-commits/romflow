import { applyFinanceActionRecord, type FinanceAction, type FinanceActionPayload } from "@/lib/server/data";
import { ensureSeeded, requireUser } from "@/lib/server/session";
import { jsonError, jsonOk, publicError, readJson } from "@/lib/server/http";

export async function POST(request: Request) {
  try {
    await ensureSeeded();
    const user = await requireUser();
    const body = await readJson<{
      expenseId?: string;
      action?: FinanceAction;
      payload?: FinanceActionPayload;
    }>(request);
    if (!body.expenseId || !body.action) {
      return jsonError("Solicitação e ação são obrigatórias.");
    }
    const expense = await applyFinanceActionRecord(user, body.expenseId, body.action, body.payload);
    return jsonOk({ expense });
  } catch (caught) {
    const message = publicError(caught);
    return jsonError(message, message === "Sessão expirada." ? 401 : 400);
  }
}
