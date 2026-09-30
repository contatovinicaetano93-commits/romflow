import { createExpenseRecord, findCompanyRow } from "@/lib/server/data";
import { notifyExpenseChange } from "@/lib/server/notify";
import { errorStatus, jsonError, jsonOk, publicError, readJson } from "@/lib/server/http";
import { assertRateLimit, clientKey } from "@/lib/server/rate-limit";
import { ensureSeeded, requireUser } from "@/lib/server/session";
import type { Expense } from "@/lib/types";

export async function POST(request: Request) {
  try {
    await ensureSeeded();
    const user = await requireUser();
    await assertRateLimit(clientKey(request, `expense-create:${user.id}`), { max: 30 });
    const input = await readJson<Omit<Expense, "id" | "created" | "updated">>(request);
    const expense = await createExpenseRecord(user, input);
    const company = await findCompanyRow(expense.company);
    const companyName = company?.name ?? expense.company;
    let emailError: string | undefined;
    try {
      const mail = await notifyExpenseChange({
        expense,
        companyName,
        actor: user,
        action: "created",
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
    return jsonError(message, errorStatus(message));
  }
}
