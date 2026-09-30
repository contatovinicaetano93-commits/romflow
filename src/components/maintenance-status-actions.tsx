"use client";

import { useState } from "react";
import { cls } from "@/lib/format";
import type { Expense, FinanceAction, RequestAction } from "@/lib/types";

export function MaintenanceStatusActions({
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
  const [confirmForId, setConfirmForId] = useState<string | null>(null);
  const canProgress = actions.includes("progress");
  const canComplete = actions.includes("complete");
  const canCancel = actions.includes("cancel");
  const confirmComplete = confirmForId === expense.id && canComplete;

  if (confirmComplete) {
    return (
      <div className="list-cancel-confirm">
        <button
          type="button"
          className="primary-button"
          disabled={busy}
          onClick={() => {
            setConfirmForId(null);
            onAction("complete");
          }}
        >
          Confirmar finalização
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={busy}
          onClick={() => setConfirmForId(null)}
        >
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="maintenance-status-actions">
      <button
        type="button"
        className={cls(
          "maintenance-status-btn",
          expense.status === "em_andamento" && "current",
          canProgress && "next",
        )}
        disabled={busy || !canProgress}
        onClick={() => onAction("progress")}
      >
        {canProgress ? "Colocar em andamento" : "Em andamento"}
      </button>
      <button
        type="button"
        className={cls(
          "maintenance-status-btn",
          expense.status === "finalizada" && "current",
          canComplete && "next",
        )}
        disabled={busy || !canComplete}
        onClick={() => setConfirmForId(expense.id)}
      >
        {canComplete ? "Finalizar" : "Finalizado"}
      </button>
      <button
        type="button"
        className={cls(
          "maintenance-status-btn",
          expense.status === "cancelada" && "current",
          canCancel && "cancel",
        )}
        disabled={busy || !canCancel}
        onClick={() => onAction("cancel")}
      >
        {canCancel ? "Cancelar" : "Cancelado"}
      </button>
    </div>
  );
}
