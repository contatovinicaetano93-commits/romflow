export type Role = "admin" | "financeiro" | "solicitante";

export type UserStatus = "active" | "inactive";

export type ExpenseStatus =
  | "enviada"
  | "em_analise"
  | "aguardando_documentacao"
  | "aprovada"
  | "agendada"
  | "paga"
  | "recusada";

export type ExpenseType =
  | "fornecedor"
  | "reembolso"
  | "adiantamento"
  | "impostos"
  | "outros";

export type PaymentMethod = "pix" | "ted" | "boleto";

export type Screen =
  | "dashboard"
  | "expenses"
  | "my-expenses"
  | "new-expense"
  | "approvals"
  | "payments"
  | "reports"
  | "users"
  | "audit"
  | "settings";

export type AuditAction =
  | "CREATE_EXPENSE"
  | "START_REVIEW"
  | "REQUEST_DOCUMENTATION"
  | "APPROVE_EXPENSE"
  | "SCHEDULE_PAYMENT"
  | "PAY_EXPENSE"
  | "REJECT_EXPENSE"
  | "UPDATE_EXPENSE"
  | "DELETE_EXPENSE";

export type Company = {
  id: string;
  name: string;
  legal_name: string;
  slug: string;
  initials: string;
  color: string;
  is_active: boolean;
};

export type Category = {
  id: string;
  name: string;
  color: string;
  is_active: boolean;
};

export type User = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  status: UserStatus;
  companyIds: string[];
  created: string;
};

export type Invitation = {
  id: string;
  email: string;
  role: Role;
  companyIds: string[];
  token: string;
  invitedBy: string;
  created: string;
  expires: string;
  accepted: boolean;
};

export type StoredFile = {
  name: string;
  size: number;
  type: string;
  dataUrl: string;
};

export type Expense = {
  id: string;
  title: string;
  description: string;
  expense_type: ExpenseType;
  event_project: string;
  amount: number;
  category: string;
  payment_method: PaymentMethod;
  beneficiary_name: string;
  beneficiary_document: string;
  pix_key: string;
  bank_name: string;
  agency: string;
  account: string;
  boleto_code: string;
  max_payment_date: string;
  receipt_justification: string;
  receipt: StoredFile | null;
  payment_proof: StoredFile | null;
  company: string;
  requester: string;
  approver: string | null;
  status: ExpenseStatus;
  scheduled_date: string | null;
  review_note: string;
  created: string;
  updated: string;
};

export type AuditLog = {
  id: string;
  user: string;
  action: AuditAction;
  resource: string;
  before: string;
  after: string;
  created: string;
};

export type Database = {
  companies: Company[];
  categories: Category[];
  users: User[];
  invitations: Invitation[];
  expenses: Expense[];
  auditLogs: AuditLog[];
};

export function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${String(value)}`);
}
