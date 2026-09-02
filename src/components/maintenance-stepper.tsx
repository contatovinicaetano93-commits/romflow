"use client";

import { cls } from "@/lib/format";
import type { Expense, ExpenseStatus, FinanceAction, RequestAction } from "@/lib/types";
import { assertNever } from "@/lib/types";

const STEPS = ["aberta", "em_andamento", "finalizada"] as const;

function stepIndex(status: ExpenseStatus): number {
  switch (status) {
    case "aberta":
      return 0;
    case "em_andamento":
      return 1;
    case "finalizada":
    case "aprovada":
      return 2;
    case "em_analise":
    case "devolvido":
    case "recusada":
    case "cancelada":
      return -1;
    default:
      return assertNever(status);
  }
}

function stepState(status: ExpenseStatus, step: (typeof STEPS)[number]): "done" | "current" | "todo" {
  const current = stepIndex(status);
  const index = STEPS.indexOf(step);
  if (current > index) {
    return "done";
  }
  if (current === index) {
    return "current";
  }
  return "todo";
}

function stepLabel(step: (typeof STEPS)[number]): string {
  switch (step) {
    case "aberta":
      return "Aberta";
    case "em_andamento":
      return "Em andamento";
    case "finalizada":
      return "Finalizada";
    default:
      return assertNever(step);
  }
}

export function MaintenanceStepper({
  expense,
  actions,
  busy,
  onAction,
}: {
  expense: Expense;
  actions: RequestAction[];
  busy?: boolean;
  onAction: (action: FinanceAction) => void;
}) {
  return (
    <div className="maintenance-stepper">
      {STEPS.map((step) => {
        const state = stepState(expense.status, step);
        const canAdvance =
          (step === "em_andamento" && actions.includes("progress")) ||
          (step === "finalizada" && actions.includes("complete"));
        if (canAdvance) {
          return (
            <button
              key={step}
              type="button"
              className="maintenance-step next"
              disabled={busy}
              onClick={() => onAction(step === "em_andamento" ? "progress" : "complete")}
            >
              {stepLabel(step)}
            </button>
          );
        }
        return (
          <span key={step} className={cls("maintenance-step", state)}>
            {stepLabel(step)}
          </span>
        );
      })}
      {actions.includes("cancel") ? (
        <button
          type="button"
          className="maintenance-step cancel"
          disabled={busy}
          onClick={() => onAction("cancel")}
        >
          Cancelar
        </button>
      ) : expense.status === "cancelada" ? (
        <span className="maintenance-step current">Cancelada</span>
      ) : null}
    </div>
  );
}
