import type { ExpenseStatus, ExpenseType, PaymentMethod, Role } from "./types";

export function money(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleDateString("pt-BR");
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function shortId(id: string): string {
  return id.slice(-6).toUpperCase();
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "RO";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function daysUntil(date: string): number {
  return Math.ceil(
    (new Date(`${date}T23:59:59`).getTime() - Date.now()) / 86_400_000,
  );
}

export function maskMoneyInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const cents = Number(digits || "0") / 100;
  return cents.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}

export function parseMoneyInput(raw: string): number {
  return Number(raw.replace(/\./g, "").replace(",", ".")) || 0;
}

export const STATUS_LABEL: Record<ExpenseStatus, string> = {
  enviada: "Enviada",
  em_analise: "Em análise",
  aguardando_documentacao: "Devolvido",
  agendada: "Agendado",
  aprovada: "Aprovado",
  paga: "Pago",
  recusada: "Recusada",
};

export const STATUS_CLASS: Record<ExpenseStatus, string> = {
  enviada: "status-blue",
  em_analise: "status-violet",
  aguardando_documentacao: "status-amber",
  aprovada: "status-emerald",
  agendada: "status-cyan",
  paga: "status-emerald",
  recusada: "status-red",
};

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador",
  financeiro: "Financeiro",
  solicitante: "Solicitante",
};

export const ROLE_CLASS: Record<Role, string> = {
  admin: "role-admin",
  financeiro: "role-financeiro",
  solicitante: "role-solicitante",
};

export const EXPENSE_TYPE_LABEL: Record<ExpenseType, string> = {
  fornecedor: "Pagamento a fornecedor",
  reembolso: "Reembolso",
  adiantamento: "Adiantamento",
  impostos: "Impostos e taxas",
  outros: "Outros",
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  pix: "Chave instantânea",
  ted: "Conta bancária",
  boleto: "Código de barras",
};

export const CATEGORY_COLOR: Record<string, string> = {
  Viagem: "#6366F1",
  Alimentação: "#F59E0B",
  Escritório: "#EC4899",
  Software: "#10B981",
  Outros: "#71717A",
};

export const AUDIT_LABEL = {
  CREATE_EXPENSE: "Criou solicitação",
  START_REVIEW: "Iniciou análise",
  REQUEST_DOCUMENTATION: "Solicitou documentos",
  APPROVE_EXPENSE: "Aprovou despesa",
  SCHEDULE_PAYMENT: "Agendou pagamento",
  PAY_EXPENSE: "Concluiu pagamento",
  REJECT_EXPENSE: "Recusou despesa",
  UPDATE_EXPENSE: "Atualizou despesa",
  DELETE_EXPENSE: "Excluiu despesa",
} as const;

export const KINDNESS_PHRASES = [
  "Que bom tê-lo aqui!",
  "Que alegria vê-lo usando o Flow!",
  "Um ótimo dia! Em que podemos ajudar hoje?",
  "Você é uma pessoa fantástica, estamos aqui por você!",
  "Tenha um excelente dia de realizações!",
  "Bem-vindo de volta!",
  "Desejamos uma excelente experiência no ROM Flow hoje.",
];

export function cls(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
