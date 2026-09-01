import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { uid } from "@/lib/db/ids";
import {
  auditLogs,
  categories,
  companies,
  expenses,
  invitationCompanies,
  invitations,
  userCompanies,
  users,
} from "@/lib/db/schema";
import type {
  AuditAction,
  Category,
  Company,
  Database,
  Expense,
  ExpenseStatus,
  ExpenseType,
  Invitation,
  PaymentMethod,
  Role,
  StoredFile,
  User,
  UserStatus,
} from "@/lib/types";
import { createSession, hashPassword, loadUser, userCount, verifyPassword } from "@/lib/server/session";

export type FinanceAction =
  | "review"
  | "docs"
  | "approve"
  | "schedule"
  | "pay"
  | "reject"
  | "resubmit";

export type FinanceActionPayload = {
  note?: string;
  scheduledDate?: string;
  proof?: StoredFile | null;
  receipt?: StoredFile | null;
};

function mapCompany(row: typeof companies.$inferSelect): Company {
  return {
    id: row.id,
    name: row.name,
    legal_name: row.legalName,
    slug: row.slug,
    initials: row.initials,
    color: row.color,
    is_active: row.isActive,
  };
}

function mapCategory(row: typeof categories.$inferSelect): Category {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    is_active: row.isActive,
  };
}

function mapExpense(row: typeof expenses.$inferSelect): Expense {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    expense_type: row.expenseType as ExpenseType,
    event_project: row.eventProject,
    amount: row.amount,
    category: row.category,
    payment_method: row.paymentMethod as PaymentMethod,
    beneficiary_name: row.beneficiaryName,
    beneficiary_document: row.beneficiaryDocument,
    pix_key: row.pixKey,
    bank_name: row.bankName,
    agency: row.agency,
    account: row.account,
    boleto_code: row.boletoCode,
    max_payment_date: row.maxPaymentDate,
    receipt_justification: row.receiptJustification,
    receipt: row.receipt ?? null,
    payment_proof: row.paymentProof ?? null,
    company: row.companyId,
    requester: row.requesterId,
    approver: row.approverId,
    status: row.status as ExpenseStatus,
    scheduled_date: row.scheduledDate,
    review_note: row.reviewNote,
    created: row.created,
    updated: row.updated,
  };
}

async function loadAllUsers(): Promise<User[]> {
  const db = getDb();
  const rows = await db.select().from(users);
  const links = await db.select().from(userCompanies);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as Role,
    status: row.status as UserStatus,
    companyIds: links.filter((item) => item.userId === row.id).map((item) => item.companyId),
    created: row.created,
  }));
}

async function loadInvitations(): Promise<Invitation[]> {
  const db = getDb();
  const rows = await db.select().from(invitations).orderBy(desc(invitations.created));
  const links = await db.select().from(invitationCompanies);
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role as Role,
    companyIds: links.filter((item) => item.invitationId === row.id).map((item) => item.companyId),
    token: row.token,
    invitedBy: row.invitedBy,
    created: row.created,
    expires: row.expires,
    accepted: row.accepted,
  }));
}

async function writeAudit(
  actorId: string,
  action: AuditAction,
  resource: string,
  before: string,
  after: string,
): Promise<void> {
  await getDb()
    .insert(auditLogs)
    .values({
      id: uid("aud"),
      userId: actorId,
      action,
      resource,
      before,
      after,
      created: new Date().toISOString(),
    });
}

export async function getSnapshot(actor: User): Promise<Database> {
  const db = getDb();
  const companyRows = await db.select().from(companies);
  const categoryRows = await db.select().from(categories);
  const expenseRows = await db.select().from(expenses).orderBy(desc(expenses.created));
  const allUsers = actor.role === "solicitante" ? [actor] : await loadAllUsers();
  const allInvites = actor.role === "admin" ? await loadInvitations() : [];
  const logs =
    actor.role === "admin"
      ? await db.select().from(auditLogs).orderBy(desc(auditLogs.created))
      : [];

  const visibleCompanies =
    actor.role === "admin" || actor.role === "financeiro"
      ? companyRows
      : companyRows.filter((item) => actor.companyIds.includes(item.id));

  const visibleExpenses = expenseRows.filter((item) => {
    if (actor.role === "solicitante") {
      return item.requesterId === actor.id;
    }
    if (actor.role === "financeiro" || actor.role === "admin") {
      return true;
    }
    return false;
  });

  return {
    revision: 1,
    companies: visibleCompanies.map(mapCompany),
    categories: categoryRows.map(mapCategory),
    users: allUsers,
    invitations: allInvites,
    expenses: visibleExpenses.map(mapExpense),
    auditLogs: logs.map((item) => ({
      id: item.id,
      user: item.userId,
      action: item.action as AuditAction,
      resource: item.resource,
      before: item.before,
      after: item.after,
      created: item.created,
    })),
  };
}

export async function loginWithPassword(email: string, password: string): Promise<User> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1);
  if (!row || !(await verifyPassword(password, row.passwordHash))) {
    throw new Error("Failed to authenticate.");
  }
  if (row.status !== "active") {
    throw new Error("Este acesso está desativado. Fale com o administrador.");
  }
  const user = await loadUser(row.id);
  if (!user) {
    throw new Error("Failed to authenticate.");
  }
  await createSession(user.id);
  return user;
}

export async function bootstrapAdmin(name: string, email: string, password: string): Promise<User> {
  if ((await userCount()) > 0) {
    throw new Error("Já existe um acesso cadastrado.");
  }
  const db = getDb();
  const companyRows = await db.select({ id: companies.id }).from(companies);
  const created = new Date().toISOString();
  const admin: User = {
    id: uid("usr"),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    role: "admin",
    status: "active",
    companyIds: companyRows.map((item) => item.id),
    created,
  };
  await db.insert(users).values({
    id: admin.id,
    name: admin.name,
    email: admin.email,
    passwordHash: await hashPassword(password),
    role: "admin",
    status: "active",
    created,
  });
  if (admin.companyIds.length) {
    await db.insert(userCompanies).values(
      admin.companyIds.map((companyId) => ({
        userId: admin.id,
        companyId,
      })),
    );
  }
  await createSession(admin.id);
  return admin;
}

export async function createExpenseRecord(
  actor: User,
  input: Omit<Expense, "id" | "created" | "updated">,
): Promise<Expense> {
  const created = new Date().toISOString();
  const expense: Expense = {
    ...input,
    id: uid("exp"),
    created,
    updated: created,
  };
  await getDb()
    .insert(expenses)
    .values({
      id: expense.id,
      title: expense.title,
      description: expense.description,
      expenseType: expense.expense_type,
      eventProject: expense.event_project,
      amount: expense.amount,
      category: expense.category,
      paymentMethod: expense.payment_method,
      beneficiaryName: expense.beneficiary_name,
      beneficiaryDocument: expense.beneficiary_document,
      pixKey: expense.pix_key,
      bankName: expense.bank_name,
      agency: expense.agency,
      account: expense.account,
      boletoCode: expense.boleto_code,
      maxPaymentDate: expense.max_payment_date,
      receiptJustification: expense.receipt_justification,
      receipt: expense.receipt,
      paymentProof: expense.payment_proof,
      companyId: expense.company,
      requesterId: actor.id,
      approverId: expense.approver,
      status: expense.status,
      scheduledDate: expense.scheduled_date,
      reviewNote: expense.review_note,
      created,
      updated: created,
    });
  await writeAudit(actor.id, "CREATE_EXPENSE", expense.id, "—", "enviada");
  return expense;
}

export async function applyFinanceActionRecord(
  actor: User,
  expenseId: string,
  action: FinanceAction,
  payload?: FinanceActionPayload,
): Promise<Expense> {
  if (actor.role !== "admin" && actor.role !== "financeiro" && action !== "resubmit") {
    throw new Error("Sem permissão para esta ação.");
  }
  const db = getDb();
  const [currentRow] = await db.select().from(expenses).where(eq(expenses.id, expenseId)).limit(1);
  if (!currentRow) {
    throw new Error("Solicitação não encontrada.");
  }
  const current = mapExpense(currentRow);
  let status: ExpenseStatus = current.status;
  let audit: AuditAction = "UPDATE_EXPENSE";
  switch (action) {
    case "review":
      status = "em_analise";
      audit = "START_REVIEW";
      break;
    case "docs":
      if (!payload?.note || payload.note.trim().length < 10) {
        throw new Error("Por favor, descreva quais documentos estão faltando.");
      }
      status = "aguardando_documentacao";
      audit = "REQUEST_DOCUMENTATION";
      break;
    case "approve":
      status = "aprovada";
      audit = "APPROVE_EXPENSE";
      break;
    case "schedule":
      if (!payload?.scheduledDate) {
        throw new Error("Informe a data de agendamento.");
      }
      status = "agendada";
      audit = "SCHEDULE_PAYMENT";
      break;
    case "pay":
      if (!payload?.proof && !current.payment_proof) {
        throw new Error("O envio do comprovante de pagamento é obrigatório.");
      }
      status = "paga";
      audit = "PAY_EXPENSE";
      break;
    case "reject":
      if (!payload?.note || payload.note.trim().length < 10) {
        throw new Error("Informe o motivo da recusa.");
      }
      status = "recusada";
      audit = "REJECT_EXPENSE";
      break;
    case "resubmit":
      if (current.requester !== actor.id && actor.role !== "admin") {
        throw new Error("Só o solicitante pode reenviar esta solicitação.");
      }
      if (current.status !== "aguardando_documentacao") {
        throw new Error("Só é possível reenviar solicitações devolvidas.");
      }
      if (!payload?.receipt && !current.receipt) {
        throw new Error("Anexe o documento solicitado antes de reenviar.");
      }
      status = "em_analise";
      audit = "UPDATE_EXPENSE";
      break;
    default: {
      const exhaustive: never = action;
      throw new Error(`Ação não suportada: ${exhaustive}`);
    }
  }
  const updated: Expense = {
    ...current,
    status,
    approver: action === "resubmit" ? current.approver : actor.id,
    review_note: payload?.note ?? current.review_note,
    scheduled_date:
      action === "schedule" ? (payload?.scheduledDate ?? current.scheduled_date) : current.scheduled_date,
    payment_proof: payload?.proof ?? current.payment_proof,
    receipt: payload?.receipt ?? current.receipt,
    updated: new Date().toISOString(),
  };
  await db
    .update(expenses)
    .set({
      status: updated.status,
      approverId: updated.approver,
      reviewNote: updated.review_note,
      scheduledDate: updated.scheduled_date,
      paymentProof: updated.payment_proof,
      receipt: updated.receipt,
      updated: updated.updated,
    })
    .where(eq(expenses.id, expenseId));
  await writeAudit(actor.id, audit, expenseId, current.status, status);
  return updated;
}

export async function createInvitationRecord(
  actor: User,
  email: string,
  role: Role,
  companyIds: string[],
): Promise<Invitation> {
  const normalized = email.trim().toLowerCase();
  const db = getDb();
  const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, normalized)).limit(1);
  if (existingUser) {
    throw new Error("Já existe um usuário com este e-mail.");
  }
  const [existingInvite] = await db
    .select()
    .from(invitations)
    .where(and(eq(invitations.email, normalized), eq(invitations.accepted, false)))
    .limit(1);
  if (existingInvite) {
    throw new Error("Já existe um convite pendente para este e-mail.");
  }
  const invitation: Invitation = {
    id: uid("inv"),
    email: email.trim().toLowerCase(),
    role,
    companyIds,
    token: uid("token"),
    invitedBy: actor.id,
    created: new Date().toISOString(),
    expires: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    accepted: false,
  };
  await db.insert(invitations).values({
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    token: invitation.token,
    invitedBy: invitation.invitedBy,
    created: invitation.created,
    expires: invitation.expires,
    accepted: false,
  });
  if (companyIds.length) {
    await db.insert(invitationCompanies).values(
      companyIds.map((companyId) => ({
        invitationId: invitation.id,
        companyId,
      })),
    );
  }
  return invitation;
}

export async function getInvitationByToken(token: string): Promise<Invitation> {
  const db = getDb();
  const [row] = await db.select().from(invitations).where(eq(invitations.token, token)).limit(1);
  if (!row || row.accepted) {
    throw new Error("Convite inválido ou expirado. Solicite um novo convite ao administrador.");
  }
  if (new Date(row.expires).getTime() < Date.now()) {
    throw new Error("Convite expirado. Solicite um novo convite ao administrador.");
  }
  const links = await db
    .select()
    .from(invitationCompanies)
    .where(eq(invitationCompanies.invitationId, row.id));
  return {
    id: row.id,
    email: row.email,
    role: row.role as Role,
    companyIds: links.map((item) => item.companyId),
    token: row.token,
    invitedBy: row.invitedBy,
    created: row.created,
    expires: row.expires,
    accepted: row.accepted,
  };
}

export async function acceptInvitation(token: string, name: string, password: string): Promise<User> {
  const invitation = await getInvitationByToken(token);
  const created = new Date().toISOString();
  const nextUser: User = {
    id: uid("usr"),
    name: name.trim(),
    email: invitation.email,
    role: invitation.role,
    status: "active",
    companyIds: invitation.companyIds,
    created,
  };
  const db = getDb();
  await db.insert(users).values({
    id: nextUser.id,
    name: nextUser.name,
    email: nextUser.email,
    passwordHash: await hashPassword(password),
    role: nextUser.role,
    status: "active",
    created,
  });
  if (nextUser.companyIds.length) {
    await db.insert(userCompanies).values(
      nextUser.companyIds.map((companyId) => ({
        userId: nextUser.id,
        companyId,
      })),
    );
  }
  await db.update(invitations).set({ accepted: true }).where(eq(invitations.id, invitation.id));
  await createSession(nextUser.id);
  return nextUser;
}

export async function toggleUserStatusRecord(actor: User, userId: string): Promise<void> {
  if (actor.id === userId) {
    throw new Error("Você não pode desativar o próprio acesso.");
  }
  const db = getDb();
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!row) {
    throw new Error("Usuário não encontrado.");
  }
  await db
    .update(users)
    .set({ status: row.status === "active" ? "inactive" : "active" })
    .where(eq(users.id, userId));
}

export async function createCompanyRecord(input: { name: string; color: string }): Promise<Company> {
  const slug = input.name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const companyItem: Company = {
    id: uid("cmp"),
    name: input.name,
    legal_name: input.name,
    slug,
    initials: input.name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 3)
      .toUpperCase(),
    color: input.color,
    is_active: true,
  };
  await getDb()
    .insert(companies)
    .values({
      id: companyItem.id,
      name: companyItem.name,
      legalName: companyItem.legal_name,
      slug: companyItem.slug,
      initials: companyItem.initials,
      color: companyItem.color,
      isActive: true,
    });
  return companyItem;
}

export async function createCategoryRecord(input: { name: string; color: string }): Promise<Category> {
  const item: Category = {
    id: uid("cat"),
    name: input.name,
    color: input.color,
    is_active: true,
  };
  await getDb().insert(categories).values({
    id: item.id,
    name: item.name,
    color: item.color,
    isActive: true,
  });
  return item;
}

export async function updateCategoryRecord(id: string, patch: Partial<Category>): Promise<void> {
  const updates: Partial<typeof categories.$inferInsert> = {};
  if (patch.name !== undefined) {
    updates.name = patch.name;
  }
  if (patch.color !== undefined) {
    updates.color = patch.color;
  }
  if (patch.is_active !== undefined) {
    updates.isActive = patch.is_active;
  }
  await getDb().update(categories).set(updates).where(eq(categories.id, id));
}

export async function findUserRow(id: string): Promise<User | undefined> {
  return (await loadUser(id)) ?? undefined;
}

export async function findCompanyRow(id: string): Promise<Company | undefined> {
  const [row] = await getDb().select().from(companies).where(eq(companies.id, id)).limit(1);
  return row ? mapCompany(row) : undefined;
}
