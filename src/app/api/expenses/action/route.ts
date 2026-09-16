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
    const companyName = company?.name ?? expense.company;
    let emailError: string | undefined;
    try {
      const mail = await notifyExpenseChange({
        expense,
        companyName,
        actor: user,
        action: body.action,
      });
      emailError = mail.error;
    } catch (caught) {
      emailError = publicError(caught, "Não foi possível enviar o e-mail.");
    }
    return jsonOk({
      expense,
      emailSent: !emailError,
      emailError,
    });
  } catch (caught) {
    const message = publicError(caught);
    return jsonError(message, message === "Sessão expirada." ? 401 : 400);
  }
}
