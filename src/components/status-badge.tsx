"use client";

import {
  CheckCircle2,
  Clock3,
  FileWarning,
  Send,
  XCircle,
} from "lucide-react";
import { STATUS_CLASS, STATUS_LABEL } from "@/lib/format";
import type { ExpenseStatus } from "@/lib/types";
import { assertNever } from "@/lib/types";

function StatusIcon({ status }: { status: ExpenseStatus }) {
  switch (status) {
    case "enviada":
      return <Send size={13} />;
    case "em_analise":
      return <Clock3 size={13} />;
    case "aguardando_documentacao":
      return <FileWarning size={13} />;
    case "aprovada":
      return <CheckCircle2 size={13} />;
    case "agendada":
      return <Clock3 size={13} />;
    case "paga":
      return <CheckCircle2 size={13} />;
    case "recusada":
      return <XCircle size={13} />;
    default:
      return assertNever(status);
  }
}

export function StatusBadge({
  status,
  className,
}: {
  status: ExpenseStatus;
  className?: string;
}) {
  return (
    <span className={`status-badge ${STATUS_CLASS[status]} ${className ?? ""}`.trim()}>
      <StatusIcon status={status} />
      {STATUS_LABEL[status]}
    </span>
  );
}
