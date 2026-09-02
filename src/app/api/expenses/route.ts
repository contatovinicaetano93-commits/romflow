import { after } from "next/server";
import { createExpenseRecord, findCompanyRow } from "@/lib/server/data";
import { notifyExpenseChange } from "@/lib/server/notify";
import { ensureSeeded, requireUser } from "@/lib/server/session";
import { jsonError, jsonOk, publicError, readJson } from "@/lib/server/http";
import type { Expense } from "@/lib/types";

export async function POST(request: Request) {
  try {
    await ensureSeeded();
    const user = await requireUser();
    const input = await readJson<Omit<Expense, "id" | "created" | "updated">>(request);
    const expense = await createExpenseRecord(user, input);
    const company = await findCompanyRow(expense.company);
    const companyName = company?.name ?? expense.company;
    after(() =>
      notifyExpenseChange({
        expense,
        companyName,
        actor: user,
        action: "created",
      }).catch(() => {
        // The request already created the expense; email log records delivery failures.
      }),
    );
    return jsonOk({ expense });
  } catch (caught) {
    const message = publicError(caught);
    return jsonError(message, message === "Sessão expirada." ? 401 : 400);
  }
}
