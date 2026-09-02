import {
  applyFinanceActionRecord,
  findCompanyRow,
  type FinanceAction,
  type FinanceActionPayload,
} from "@/lib/server/data";
import { notifyExpenseChange } from "@/lib/server/notify";
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
    const company = await findCompanyRow(expense.company);
    try {
      await notifyExpenseChange({
        expense,
        companyName: company?.name ?? expense.company,
        actor: user,
        action: body.action,
      });
    } catch {
      // The status change must succeed even if a notification fails; the email log records it.
    }
    return jsonOk({ expense });
  } catch (caught) {
    const message = publicError(caught);
    return jsonError(message, message === "Sessão expirada." ? 401 : 400);
  }
}
