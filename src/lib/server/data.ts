import { and, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import { canAccessCompany } from "@/lib/access";
import { getDb } from "@/lib/db";
import { uid, inviteToken, hashToken } from "@/lib/db/ids";
import {
  auditLogs,
  categories,
  companies,
  expenses,
  invitationAreas,
  invitationCompanies,
  invitations,
  userAreas,
  userCompanies,
  users,
  emailLogs,
  passwordResets,
} from "@/lib/db/schema";
import type {
  AuditAction,
  AuditLog,
  Category,
  Company,
  Database,
  EmailLog,
  Expense,
  Invitation,
  PaymentMethod,
  RequestAction,
  RequestArea,
  Role,
  StoredFile,
  User,
  UserStatus,
} from "@/lib/types";
import {
  allowedActions,
  canAccessArea,
  canAdminArea,
  canSeeExpense,
  defaultAreasForRole,
  initialStatus,
  isAdminInbox,
  isMaster,
  isSolicitanteInbox,
  nextStatus,
  parseArea,
  parseAreas,
  parseExpenseType,
  parseRole,
  parseStatus,
  withEventDateObservation,
  assertExpenseCreate,
} from "@/lib/workflow";
import { fileProxyUrl, persistStoredFile, publicStoredFile, storedFileGrantsPathname } from "@/lib/server/blob";
import { PERSONAL_BUSINESS_IDS } from "@/lib/seed";
import { assertPassword, bumpSessionVersion, createSession, hashPassword, loadUser, userCount, verifyPassword } from "@/lib/server/session";
import {
  isProtectedDirectoryUser,
  isTombstoneEmail,
  tombstoneEmailFor,
} from "@/lib/user-directory";

export type FinanceAction = RequestAction;

export type FinanceActionPayload = {
  note?: string;
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
    area: parseArea(row.area),
    expense_type: parseExpenseType(row.expenseType),
    event_project: row.eventProject,
    event_date: row.eventDate ?? "",
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
    payment_date_justification: row.paymentDateJustification ?? "",
    receipt_justification: row.receiptJustification,
    receipt: publicStoredFile(row.receipt ?? null),
    payment_proof: publicStoredFile(row.paymentProof ?? null),
    company: row.companyId,
    requester: row.requesterId,
    approver: row.approverId,
    status: parseStatus(row.status),
    scheduled_date: row.scheduledDate,
    review_note: row.reviewNote,
    created: row.created,
    updated: row.updated,
  };
}

async function resolveCompanyIds(
  companyIds: string[],
  mode: "invite" | "access" = "access",
): Promise<string[]> {
  const unique = [...new Set(companyIds.filter(Boolean))];
  if (unique.length === 0) {
    throw new Error("Selecione ao menos uma empresa.");
  }
  const rows = await getDb().select({ id: companies.id, isActive: companies.isActive }).from(companies);
  const valid = new Set(rows.map((row) => row.id));
  const active = new Set(rows.filter((row) => row.isActive).map((row) => row.id));
  const resolved =
    mode === "invite"
      ? unique.filter((id) => active.has(id))
      : unique.filter((id) => valid.has(id));
  if (resolved.length === 0 || !resolved.some((id) => active.has(id))) {
    throw new Error("Selecione ao menos uma empresa ativa.");
  }
  return resolved;
}

async function countOtherActiveMasters(excludeUserId: string): Promise<number> {
  const adminRows = await getDb()
    .select({ id: users.id, role: users.role, status: users.status })
    .from(users);
  return adminRows.filter(
    (item) => item.id !== excludeUserId && item.status === "active" && parseRole(item.role) === "master",
  ).length;
}

export async function listCompaniesByIds(companyIds: string[]): Promise<Company[]> {
  if (companyIds.length === 0) {
    return [];
  }
  const rows = await getDb().select().from(companies).where(inArray(companies.id, companyIds));
  const order = new Map(companyIds.map((id, index) => [id, index]));
  return rows
    .map(mapCompany)
    .sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0));
}

async function replaceUserCompanies(userId: string, companyIds: string[]): Promise<void> {
  const db = getDb();
  await db.delete(userCompanies).where(eq(userCompanies.userId, userId));
  if (companyIds.length === 0) {
    return;
  }
  await db.insert(userCompanies).values(
    companyIds.map((companyId) => ({
      userId,
      companyId,
    })),
  );
}

async function replaceInvitationCompanies(invitationId: string, companyIds: string[]): Promise<void> {
  const db = getDb();
  await db.delete(invitationCompanies).where(eq(invitationCompanies.invitationId, invitationId));
  await db.insert(invitationCompanies).values(
    companyIds.map((companyId) => ({
      invitationId,
      companyId,
    })),
  );
}

async function replaceUserAreas(userId: string, areas: RequestArea[]): Promise<void> {
  const db = getDb();
  await db.delete(userAreas).where(eq(userAreas.userId, userId));
  if (areas.length === 0) {
    return;
  }
  await db.insert(userAreas).values(areas.map((area) => ({ userId, area })));
}

async function replaceInvitationAreas(invitationId: string, areas: RequestArea[]): Promise<void> {
  const db = getDb();
  await db.delete(invitationAreas).where(eq(invitationAreas.invitationId, invitationId));
  if (areas.length === 0) {
    return;
  }
  await db.insert(invitationAreas).values(areas.map((area) => ({ invitationId, area })));
}

async function loadAllUsers(): Promise<User[]> {
  const db = getDb();
  const rows = await db.select().from(users);
  const links = await db.select().from(userCompanies);
  const areaLinks = await db.select().from(userAreas);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: parseRole(row.role),
    status: row.status as UserStatus,
    companyIds: links.filter((item) => item.userId === row.id).map((item) => item.companyId),
    areaIds: parseAreas(areaLinks.filter((item) => item.userId === row.id).map((item) => item.area)),
    created: row.created,
  }));
}

async function findUserRowByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const [row] = await getDb()
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${normalized}`)
    .limit(1);
  return row ?? null;
}

export async function listNotificationRecipients(
  companyId: string,
  requesterId: string,
  area: RequestArea,
): Promise<User[]> {
  const all = await loadAllUsers();
  const seen = new Set<string>();
  const recipients: User[] = [];
  function add(user: User) {
    if (user.status !== "active") {
      return;
    }
    const key = user.email.trim().toLowerCase();
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    recipients.push(user);
  }
  const requester = all.find((item) => item.id === requesterId);
  if (requester) {
    add(requester);
  }
  for (const user of all) {
    if (user.id === requesterId) {
      continue;
    }
    if (canAccessCompany(user, companyId) && canAdminArea(user, area)) {
      add(user);
    }
  }
  return recipients;
}

function mapEmailLog(row: typeof emailLogs.$inferSelect): EmailLog {
  const role = row.toRole;
  const kind = row.kind;
  return {
    id: row.id,
    kind:
      kind === "invite" || kind === "expense_created" || kind === "expense_status" || kind === "password_reset"
        ? kind
        : "expense_status",
    expenseId: row.expenseId,
    invitationId: row.invitationId,
    toEmail: row.toEmail,
    toName: row.toName,
    toRole: (() => {
      try {
        return parseRole(role);
      } catch {
        return null;
      }
    })(),
    subject: row.subject,
    status: row.status === "sent" ? "sent" : "failed",
    error: row.error,
    resendId: row.resendId,
    created: row.created,
  };
}

async function loadInvitations(): Promise<Invitation[]> {
  const db = getDb();
  const rows = await db.select().from(invitations).orderBy(desc(invitations.created));
  const links = await db.select().from(invitationCompanies);
  const areaLinks = await db.select().from(invitationAreas);
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    role: parseRole(row.role),
    companyIds: links.filter((item) => item.invitationId === row.id).map((item) => item.companyId),
    areaIds: parseAreas(areaLinks.filter((item) => item.invitationId === row.id).map((item) => item.area)),
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

function usersForSnapshot(actor: User, allUsers: User[], visibleExpenses: Expense[]): User[] {
  if (isMaster(actor.role)) {
    return allUsers;
  }
  if (actor.role === "solicitante") {
    return [actor];
  }
  const ids = new Set<string>([actor.id]);
  for (const expense of visibleExpenses) {
    ids.add(expense.requester);
    if (expense.approver) {
      ids.add(expense.approver);
    }
  }
  return allUsers.filter((item) => ids.has(item.id));
}

const INBOX_STATUSES = [
  "em_analise",
  "devolvido",
  "aprovada",
  "recusada",
  "aberta",
  "em_andamento",
  "finalizada",
] as const;

const INBOX_PER_COMPANY = 8;

export function emptySnapshot(): Database {
  return {
    revision: 1,
    companies: [],
    categories: [],
    users: [],
    invitations: [],
    expenses: [],
    auditLogs: [],
    emailLogs: [],
  };
}

function mapAuditLog(item: typeof auditLogs.$inferSelect): AuditLog {
  return {
    id: item.id,
    user: item.userId,
    action: item.action as AuditAction,
    resource: item.resource,
    before: item.before,
    after: item.after,
    created: item.created,
  };
}

function mapInboxExpense(row: {
  id: string;
  title: string;
  area: string;
  status: string;
  companyId: string;
  requesterId: string;
  created: string;
}): Expense {
  return {
    id: row.id,
    title: row.title,
    description: "",
    area: parseArea(row.area),
    expense_type: "outros",
    event_project: "",
    event_date: "",
    amount: 0,
    category: "",
    payment_method: "pix",
    beneficiary_name: "",
    beneficiary_document: "",
    pix_key: "",
    bank_name: "",
    agency: "",
    account: "",
    boleto_code: "",
    max_payment_date: "",
    payment_date_justification: "",
    receipt_justification: "",
    receipt: null,
    payment_proof: null,
    company: row.companyId,
    requester: row.requesterId,
    approver: null,
    status: parseStatus(row.status),
    scheduled_date: null,
    review_note: "",
    created: row.created,
    updated: row.created,
  };
}

function visibleCompaniesFor(actor: User, companyRows: Array<typeof companies.$inferSelect>) {
  return isMaster(actor.role)
    ? companyRows
    : companyRows.filter((item) => actor.companyIds.includes(item.id));
}

async function loadInboxExpenses(actor: User): Promise<Expense[]> {
  const filters = [inArray(expenses.status, [...INBOX_STATUSES])];
  if (actor.role === "solicitante") {
    filters.push(eq(expenses.requesterId, actor.id));
  } else if (!isMaster(actor.role) && actor.companyIds.length > 0) {
    filters.push(inArray(expenses.companyId, actor.companyIds));
  } else if (!isMaster(actor.role)) {
    return [];
  }
  const rows = await getDb()
    .select({
      id: expenses.id,
      title: expenses.title,
      area: expenses.area,
      status: expenses.status,
      companyId: expenses.companyId,
      requesterId: expenses.requesterId,
      created: expenses.created,
    })
    .from(expenses)
    .where(and(...filters))
    .orderBy(desc(expenses.created));
  const counts = new Map<string, number>();
  const inbox: Expense[] = [];
  for (const row of rows) {
    const expense = mapInboxExpense(row);
    if (!canSeeExpense(actor, expense)) {
      continue;
    }
    const relevant =
      actor.role === "solicitante" ? isSolicitanteInbox(expense) : isAdminInbox(expense);
    if (!relevant) {
      continue;
    }
    const count = counts.get(expense.company) ?? 0;
    if (count >= INBOX_PER_COMPANY) {
      continue;
    }
    counts.set(expense.company, count + 1);
    inbox.push(expense);
  }
  return inbox;
}

export type CompanyWorkset = {
  expenses: Expense[];
  users: User[];
};

export type OpsSnapshot = {
  auditLogs: AuditLog[];
  emailLogs: EmailLog[];
};

export async function getBootstrapSnapshot(actor: User): Promise<Database> {
  const db = getDb();
  const [companyRows, categoryRows, allUsers, allInvites, inbox] = await Promise.all([
    db.select().from(companies),
    db.select().from(categories),
    actor.role === "solicitante" ? Promise.resolve([actor]) : loadAllUsers(),
    isMaster(actor.role) ? loadInvitations() : Promise.resolve([] as Invitation[]),
    loadInboxExpenses(actor),
  ]);
  return {
    revision: 1,
    companies: visibleCompaniesFor(actor, companyRows).map(mapCompany),
    categories: categoryRows.map(mapCategory),
    users: usersForSnapshot(actor, allUsers, inbox),
    invitations: allInvites,
    expenses: inbox,
    auditLogs: [],
    emailLogs: [],
  };
}

export async function getCompanyWorkset(actor: User, companyId: string): Promise<CompanyWorkset> {
  if (!canAccessCompany(actor, companyId)) {
    throw new Error("Você não tem acesso a esta empresa.");
  }
  const db = getDb();
  const expenseRows = await db
    .select()
    .from(expenses)
    .where(eq(expenses.companyId, companyId))
    .orderBy(desc(expenses.created));
  const visibleExpenses = expenseRows.map(mapExpense).filter((item) => canSeeExpense(actor, item));
  if (actor.role === "solicitante") {
    return { expenses: visibleExpenses, users: [actor] };
  }
  if (isMaster(actor.role)) {
    return { expenses: visibleExpenses, users: [] };
  }
  const allUsers = await loadAllUsers();
  return { expenses: visibleExpenses, users: usersForSnapshot(actor, allUsers, visibleExpenses) };
}

export async function getOpsSnapshot(actor: User): Promise<OpsSnapshot> {
  if (!isMaster(actor.role)) {
    return { auditLogs: [], emailLogs: [] };
  }
  const db = getDb();
  const [logs, mailRows] = await Promise.all([
    db.select().from(auditLogs).orderBy(desc(auditLogs.created)),
    db.select().from(emailLogs).orderBy(desc(emailLogs.created)),
  ]);
  return {
    auditLogs: logs.map(mapAuditLog),
    emailLogs: mailRows.map(mapEmailLog),
  };
}

export async function getSnapshot(actor: User): Promise<Database> {
  const [boot, ops] = await Promise.all([getBootstrapSnapshot(actor), getOpsSnapshot(actor)]);
  return {
    ...boot,
    auditLogs: ops.auditLogs,
    emailLogs: ops.emailLogs,
  };
}

export async function getBootstrapSnapshotSafe(actor: User): Promise<Database | null> {
  try {
    return await getBootstrapSnapshot(actor);
  } catch {
    return null;
  }
}

export async function getSnapshotSafe(actor: User): Promise<Database | null> {
  try {
    return await getSnapshot(actor);
  } catch {
    return null;
  }
}

export async function loginWithPassword(email: string, password: string): Promise<User> {
  const row = await findUserRowByEmail(email);
  if (!row || !(await verifyPassword(password, row.passwordHash)) || isTombstoneEmail(row.email)) {
    throw new Error("E-mail ou senha incorretos.");
  }
  if (row.status !== "active") {
    throw new Error("Este acesso está desativado. Use Esqueci a senha só depois que o acesso for reativado.");
  }
  const user = await loadUser(row.id);
  if (!user) {
    throw new Error("E-mail ou senha incorretos.");
  }
  await createSession(user.id);
  return user;
}

export async function bootstrapAdmin(name: string, email: string, password: string): Promise<User> {
  if ((await userCount()) > 0) {
    throw new Error("Já existe um acesso cadastrado.");
  }
  assertPassword(password);
  const db = getDb();
  const companyRows = await db.select({ id: companies.id }).from(companies);
  const created = new Date().toISOString();
  const admin: User = {
    id: uid("usr"),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    role: "master",
    status: "active",
    companyIds: companyRows.map((item) => item.id),
    areaIds: ["financeiro", "manutencao", "compras", "rh"],
    created,
  };
  await db.insert(users).values({
    id: admin.id,
    name: admin.name,
    email: admin.email,
    passwordHash: await hashPassword(password),
    role: "master",
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
  await replaceUserAreas(admin.id, admin.areaIds);
  await createSession(admin.id);
  return admin;
}

export async function createExpenseRecord(
  actor: User,
  input: Omit<Expense, "id" | "created" | "updated">,
): Promise<Expense> {
  if (!canAccessCompany(actor, input.company)) {
    throw new Error("Você não tem acesso a esta empresa.");
  }
  const company = await findCompanyRow(input.company);
  if (!company) {
    throw new Error("Empresa não encontrada.");
  }
  if (!company.is_active) {
    throw new Error("Esta empresa está inativa.");
  }
  if (!canAccessArea(actor, input.area)) {
    throw new Error("Você não tem acesso a esta área de solicitação.");
  }
  const amount = assertExpenseCreate(input);
  const created = new Date().toISOString();
  const receipt = await persistStoredFile(input.receipt, "receipts", actor.id);
  const expense: Expense = {
    ...input,
    amount,
    description: withEventDateObservation(input.description, input.expense_type, input.event_date),
    requester: actor.id,
    status: initialStatus(input.area),
    receipt,
    payment_proof: null,
    approver: null,
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
      area: expense.area,
      expenseType: expense.expense_type,
      eventProject: expense.event_project,
      eventDate: expense.event_date,
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
      paymentDateJustification: expense.payment_date_justification,
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
  await writeAudit(actor.id, "CREATE_EXPENSE", expense.id, "—", expense.status);
  return expense;
}

export async function applyFinanceActionRecord(
  actor: User,
  expenseId: string,
  action: FinanceAction,
  payload?: FinanceActionPayload,
): Promise<Expense> {
  const db = getDb();
  const [currentRow] = await db.select().from(expenses).where(eq(expenses.id, expenseId)).limit(1);
  if (!currentRow) {
    throw new Error("Solicitação não encontrada.");
  }
  const current = mapExpense(currentRow);
  if (!canSeeExpense(actor, current)) {
    throw new Error("Você não tem acesso a esta solicitação.");
  }
  const permitted = allowedActions(actor, current);
  if (!permitted.includes(action)) {
    throw new Error("Sem permissão para esta ação.");
  }
  if ((action === "reject" || action === "docs") && !payload?.note?.trim()) {
    throw new Error("Informe a justificativa.");
  }
  if (action === "attach_proof" && !payload?.proof && !current.payment_proof) {
    throw new Error("Anexe o recibo de pagamento.");
  }
  if (action === "resubmit" && !payload?.receipt && !current.receipt) {
    throw new Error("Anexe o documento solicitado antes de reenviar.");
  }
  const status = nextStatus(action, current);
  let audit: AuditAction = "UPDATE_EXPENSE";
  switch (action) {
    case "docs":
      audit = "REQUEST_DOCUMENTATION";
      break;
    case "approve":
      audit = "APPROVE_EXPENSE";
      break;
    case "reject":
      audit = "REJECT_EXPENSE";
      break;
    case "resubmit":
      audit = "UPDATE_EXPENSE";
      break;
    case "attach_proof":
      audit = "ATTACH_PROOF";
      break;
    case "progress":
      audit = "PROGRESS_EXPENSE";
      break;
    case "complete":
      audit = "COMPLETE_EXPENSE";
      break;
    case "cancel":
      audit = "CANCEL_EXPENSE";
      break;
    default: {
      const exhaustive: never = action;
      throw new Error(`Ação não suportada: ${exhaustive}`);
    }
  }
  const paymentProof = await persistStoredFile(
    payload?.proof ?? current.payment_proof,
    "proofs",
    actor.id,
    current.payment_proof,
  );
  const receipt = await persistStoredFile(payload?.receipt ?? current.receipt, "receipts", actor.id, current.receipt);
  const updated: Expense = {
    ...current,
    status,
    approver: action === "resubmit" || action === "progress" || action === "complete" || action === "cancel"
      ? current.approver
      : actor.id,
    review_note: payload?.note ?? current.review_note,
    payment_proof: paymentProof,
    receipt,
    updated: new Date().toISOString(),
  };
  const result = await db
    .update(expenses)
    .set({
      status: updated.status,
      approverId: updated.approver,
      reviewNote: updated.review_note,
      paymentProof: updated.payment_proof,
      receipt: updated.receipt,
      updated: updated.updated,
    })
    .where(and(eq(expenses.id, expenseId), eq(expenses.status, current.status)))
    .returning({ id: expenses.id });
  if (result.length === 0) {
    throw new Error("Esta solicitação já foi atualizada. Recarregue e tente de novo.");
  }
  await writeAudit(actor.id, audit, expenseId, current.status, status);
  return updated;
}

async function cancelPendingInvitesForEmail(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  await getDb()
    .delete(invitations)
    .where(and(sql`lower(${invitations.email}) = ${normalized}`, eq(invitations.accepted, false)));
}

async function tombstoneUserRow(row: typeof users.$inferSelect): Promise<string> {
  const nextEmail = tombstoneEmailFor(row.id);
  const db = getDb();
  await db
    .update(users)
    .set({
      status: "inactive",
      email: nextEmail,
    })
    .where(eq(users.id, row.id));
  await replaceUserCompanies(row.id, []);
  await replaceUserAreas(row.id, []);
  await bumpSessionVersion(row.id);
  await db.delete(passwordResets).where(eq(passwordResets.userId, row.id));
  await cancelPendingInvitesForEmail(row.email);
  return nextEmail;
}

export async function createInvitationRecord(
  actor: User,
  email: string,
  role: Role,
  companyIds: string[],
  areaIds: RequestArea[],
): Promise<{ invitation: Invitation; releasedUserId: string | null }> {
  if (!isMaster(actor.role)) {
    throw new Error("Apenas o master pode criar acessos.");
  }
  const normalized = email.trim().toLowerCase();
  const resolvedRole = parseRole(role);
  const resolvedCompanies = await resolveCompanyIds(companyIds, "invite");
  const resolvedAreas = defaultAreasForRole(resolvedRole, areaIds);
  const db = getDb();
  const existingUser = await findUserRowByEmail(normalized);
  let releasedUserId: string | null = null;
  if (existingUser) {
    if (existingUser.status === "active" && !isTombstoneEmail(existingUser.email)) {
      throw new Error("Já existe um usuário ativo com este e-mail.");
    }
    await tombstoneUserRow(existingUser);
    releasedUserId = existingUser.id;
  }
  await cancelPendingInvitesForEmail(normalized);
  const invitation: Invitation = {
    id: uid("inv"),
    email: email.trim().toLowerCase(),
    role: resolvedRole,
    companyIds: resolvedCompanies,
    areaIds: resolvedAreas,
    token: inviteToken(),
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
  if (resolvedCompanies.length) {
    await db.insert(invitationCompanies).values(
      resolvedCompanies.map((companyId) => ({
        invitationId: invitation.id,
        companyId,
      })),
    );
  }
  await replaceInvitationAreas(invitation.id, resolvedAreas);
  await writeAudit(actor.id, "CREATE_INVITE", invitation.id, "—", invitation.email);
  return { invitation, releasedUserId };
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
  const areaLinks = await db
    .select()
    .from(invitationAreas)
    .where(eq(invitationAreas.invitationId, row.id));
  return {
    id: row.id,
    email: row.email,
    role: parseRole(row.role),
    companyIds: links.map((item) => item.companyId),
    areaIds: parseAreas(areaLinks.map((item) => item.area)),
    token: row.token,
    invitedBy: row.invitedBy,
    created: row.created,
    expires: row.expires,
    accepted: row.accepted,
  };
}

function companyIdsForAcceptedInvite(role: Role, invitedCompanyIds: string[]): string[] {
  if (role !== "master" && role !== "admin_financeiro") {
    return invitedCompanyIds;
  }
  const companyIds = [...invitedCompanyIds];
  for (const companyId of PERSONAL_BUSINESS_IDS) {
    if (!companyIds.includes(companyId)) {
      companyIds.push(companyId);
    }
  }
  return companyIds;
}

async function applyAcceptedInvitation(
  userId: string,
  invitation: Invitation,
  name: string,
  password: string,
): Promise<User> {
  const companyIds = companyIdsForAcceptedInvite(invitation.role, invitation.companyIds);
  const areaIds = invitation.areaIds.length
    ? invitation.areaIds
    : defaultAreasForRole(invitation.role, invitation.role === "solicitante" ? ["financeiro"] : []);
  const db = getDb();
  await db
    .update(users)
    .set({
      name: name.trim(),
      email: invitation.email,
      passwordHash: await hashPassword(password),
      role: invitation.role,
      status: "active",
    })
    .where(eq(users.id, userId));
  await replaceUserCompanies(userId, companyIds);
  await replaceUserAreas(userId, areaIds);
  await db.update(invitations).set({ accepted: true }).where(eq(invitations.id, invitation.id));
  const sessionVersion = await bumpSessionVersion(userId);
  await createSession(userId, sessionVersion);
  const updated = await loadUser(userId);
  if (!updated) {
    throw new Error("Usuário não encontrado.");
  }
  return updated;
}

export async function acceptInvitation(token: string, name: string, password: string): Promise<User> {
  assertPassword(password);
  const invitation = await getInvitationByToken(token);
  const existing = await findUserRowByEmail(invitation.email);
  if (existing) {
    if (existing.status === "active") {
      throw new Error("Já existe um usuário ativo com este e-mail.");
    }
    return applyAcceptedInvitation(existing.id, invitation, name, password);
  }
  const created = new Date().toISOString();
  const nextUser: User = {
    id: uid("usr"),
    name: name.trim(),
    email: invitation.email,
    role: invitation.role,
    status: "active",
    companyIds: companyIdsForAcceptedInvite(invitation.role, invitation.companyIds),
    areaIds: invitation.areaIds.length
      ? invitation.areaIds
      : defaultAreasForRole(invitation.role, invitation.role === "solicitante" ? ["financeiro"] : []),
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
  await replaceUserAreas(nextUser.id, nextUser.areaIds);
  await db.update(invitations).set({ accepted: true }).where(eq(invitations.id, invitation.id));
  await createSession(nextUser.id);
  return nextUser;
}

export async function updateUserAccessRecord(
  actor: User,
  userId: string,
  role: Role,
  companyIds: string[],
  areaIds: RequestArea[],
): Promise<User> {
  if (!isMaster(actor.role)) {
    throw new Error("Apenas o master pode editar acessos.");
  }
  const resolvedRole = parseRole(role);
  const resolvedCompanies = await resolveCompanyIds(companyIds);
  const resolvedAreas = defaultAreasForRole(resolvedRole, areaIds);
  const db = getDb();
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!row) {
    throw new Error("Usuário não encontrado.");
  }
  if (actor.id === userId && resolvedRole !== "master") {
    throw new Error("Você não pode remover o próprio perfil de master.");
  }
  if (parseRole(row.role) === "master" && resolvedRole !== "master") {
    if ((await countOtherActiveMasters(userId)) === 0) {
      throw new Error("É preciso manter ao menos um master ativo.");
    }
  }
  const previousLinks = await db
    .select({ companyId: userCompanies.companyId })
    .from(userCompanies)
    .where(eq(userCompanies.userId, userId));
  await db.update(users).set({ role: resolvedRole }).where(eq(users.id, userId));
  await replaceUserCompanies(userId, resolvedCompanies);
  await replaceUserAreas(userId, resolvedAreas);
  await writeAudit(
    actor.id,
    "UPDATE_USER",
    userId,
    `${row.role} | ${previousLinks.map((item) => item.companyId).join(",") || "nenhuma"}`,
    `${resolvedRole} | ${resolvedCompanies.join(",")} | ${resolvedAreas.join(",")}`,
  );
  const updated = await loadUser(userId);
  if (!updated) {
    throw new Error("Usuário não encontrado.");
  }
  return updated;
}

export async function updateInvitationAccessRecord(
  invitationId: string,
  role: Role,
  companyIds: string[],
  areaIds: RequestArea[],
): Promise<Invitation> {
  const resolvedRole = parseRole(role);
  const resolvedCompanies = await resolveCompanyIds(companyIds, "invite");
  const resolvedAreas = defaultAreasForRole(resolvedRole, areaIds);
  const db = getDb();
  const [row] = await db.select().from(invitations).where(eq(invitations.id, invitationId)).limit(1);
  if (!row || row.accepted) {
    throw new Error("Convite inválido ou já utilizado.");
  }
  await db.update(invitations).set({ role: resolvedRole }).where(eq(invitations.id, invitationId));
  await replaceInvitationCompanies(invitationId, resolvedCompanies);
  await replaceInvitationAreas(invitationId, resolvedAreas);
  return {
    id: row.id,
    email: row.email,
    role: resolvedRole,
    companyIds: resolvedCompanies,
    areaIds: resolvedAreas,
    token: row.token,
    invitedBy: row.invitedBy,
    created: row.created,
    expires: row.expires,
    accepted: row.accepted,
  };
}

export async function toggleUserStatusRecord(actor: User, userId: string): Promise<User> {
  if (actor.id === userId) {
    throw new Error("Você não pode desativar o próprio acesso.");
  }
  const db = getDb();
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!row) {
    throw new Error("Usuário não encontrado.");
  }
  const nextStatus = row.status === "active" ? "inactive" : "active";
  if (nextStatus === "inactive" && parseRole(row.role) === "master") {
    if ((await countOtherActiveMasters(userId)) === 0) {
      throw new Error("É preciso manter ao menos um master ativo.");
    }
  }
  await db.update(users).set({ status: nextStatus }).where(eq(users.id, userId));
  if (nextStatus === "inactive") {
    await bumpSessionVersion(userId);
    await cancelPendingInvitesForEmail(row.email);
  }
  await writeAudit(actor.id, "TOGGLE_USER", userId, row.status, nextStatus);
  const updated = await loadUser(userId);
  if (!updated) {
    throw new Error("Usuário não encontrado.");
  }
  return updated;
}

export async function revokeUserAccessRecord(
  actor: User,
  userId: string,
): Promise<{ user: User; releasedEmail: string }> {
  if (!isMaster(actor.role)) {
    throw new Error("Apenas o master pode excluir acessos.");
  }
  if (actor.id === userId) {
    throw new Error("Você não pode excluir o próprio acesso.");
  }
  const db = getDb();
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!row) {
    throw new Error("Usuário não encontrado.");
  }
  if (parseRole(row.role) === "master") {
    if ((await countOtherActiveMasters(userId)) === 0) {
      throw new Error("É preciso manter ao menos um master ativo.");
    }
  }
  const releasedEmail = row.email;
  await tombstoneUserRow(row);
  await writeAudit(actor.id, "REVOKE_USER", userId, releasedEmail, "excluído");
  const updated = await loadUser(userId);
  if (!updated) {
    throw new Error("Usuário não encontrado.");
  }
  return { user: updated, releasedEmail };
}

export async function resetAccessDirectoryRecord(
  actor: User,
): Promise<{ users: User[]; removed: number }> {
  if (!isMaster(actor.role)) {
    throw new Error("Apenas o master pode zerar os cadastros.");
  }
  const db = getDb();
  const rows = await db.select().from(users);
  let removed = 0;
  for (const row of rows) {
    if (isProtectedDirectoryUser(row, actor.id) || isTombstoneEmail(row.email)) {
      continue;
    }
    if (parseRole(row.role) === "master" && (await countOtherActiveMasters(row.id)) === 0) {
      continue;
    }
    await tombstoneUserRow(row);
    removed += 1;
  }
  await db.delete(invitations);
  await writeAudit(
    actor.id,
    "RESET_DIRECTORY",
    "users",
    String(rows.length),
    `mantidos ${rows.length - removed}; removidos ${removed}`,
  );
  return { users: await loadAllUsers(), removed };
}

export async function cancelInvitationRecord(actor: User, invitationId: string): Promise<void> {
  if (!isMaster(actor.role)) {
    throw new Error("Apenas o master pode excluir convites.");
  }
  const db = getDb();
  const [row] = await db.select().from(invitations).where(eq(invitations.id, invitationId)).limit(1);
  if (!row || row.accepted) {
    throw new Error("Convite inválido ou já utilizado.");
  }
  await db.delete(invitations).where(eq(invitations.id, invitationId));
  await writeAudit(actor.id, "REVOKE_USER", invitationId, row.email, "convite cancelado");
}

export async function createCompanyRecord(
  actor: User,
  input: { name: string; color: string },
): Promise<Company> {
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
  const db = getDb();
  await db.insert(companies).values({
    id: companyItem.id,
    name: companyItem.name,
    legalName: companyItem.legal_name,
    slug: companyItem.slug,
    initials: companyItem.initials,
    color: companyItem.color,
    isActive: true,
  });
  const adminRows = await db.select({ id: users.id, role: users.role, status: users.status }).from(users);
  const grantIds = new Set<string>([actor.id]);
  for (const row of adminRows) {
    if (row.status === "active" && parseRole(row.role) === "master") {
      grantIds.add(row.id);
    }
  }
  await db.insert(userCompanies).values(
    [...grantIds].map((userId) => ({
      userId,
      companyId: companyItem.id,
    })),
  );
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

export async function updateCategoryRecord(id: string, patch: Partial<Category>): Promise<Category> {
  const db = getDb();
  const [row] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  if (!row) {
    throw new Error("Categoria não encontrada.");
  }
  const nextName = patch.name === undefined ? row.name : patch.name.trim();
  if (!nextName) {
    throw new Error("Informe o nome da categoria.");
  }
  if (nextName.toLowerCase() !== row.name.toLowerCase()) {
    const [duplicate] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(sql`lower(${categories.name}) = ${nextName.toLowerCase()}`, ne(categories.id, id)))
      .limit(1);
    if (duplicate) {
      throw new Error("Já existe uma categoria com este nome.");
    }
  }
  const nextColor = patch.color ?? row.color;
  const nextActive = patch.is_active ?? row.isActive;
  await db
    .update(categories)
    .set({
      name: nextName,
      color: nextColor,
      isActive: nextActive,
    })
    .where(eq(categories.id, id));
  if (nextName !== row.name) {
    await db.update(expenses).set({ category: nextName }).where(eq(expenses.category, row.name));
  }
  return {
    id: row.id,
    name: nextName,
    color: nextColor,
    is_active: nextActive,
  };
}

export async function updateCompanyStatusRecord(actor: User, companyId: string, isActive: boolean): Promise<Company> {
  if (!isMaster(actor.role)) {
    throw new Error("Apenas o master pode fazer isso.");
  }
  const db = getDb();
  const [row] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
  if (!row) {
    throw new Error("Empresa não encontrada.");
  }
  if (row.isActive && !isActive) {
    const activeRows = await db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.isActive, true));
    if (activeRows.length <= 1) {
      throw new Error("É preciso manter ao menos uma empresa ativa.");
    }
  }
  await db.update(companies).set({ isActive }).where(eq(companies.id, companyId));
  await writeAudit(
    actor.id,
    "TOGGLE_COMPANY",
    companyId,
    row.isActive ? "ativa" : "inativa",
    isActive ? "ativa" : "inativa",
  );
  return mapCompany({ ...row, isActive });
}

export async function requestPasswordReset(
  email: string,
): Promise<{ id: string; userId: string; token: string; name: string; email: string } | null> {
  const row = await findUserRowByEmail(email);
  if (!row || row.status !== "active" || isTombstoneEmail(row.email)) {
    return null;
  }
  const token = inviteToken();
  const id = uid("pwr");
  const db = getDb();
  await db.insert(passwordResets).values({
    id,
    userId: row.id,
    tokenHash: hashToken(token),
    expires: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    used: false,
    created: new Date().toISOString(),
  });
  return { id, userId: row.id, token, name: row.name, email: row.email };
}

export async function finalizePasswordResetIssue(input: {
  id: string;
  userId: string;
  delivered: boolean;
}): Promise<void> {
  const db = getDb();
  if (!input.delivered) {
    await db.delete(passwordResets).where(eq(passwordResets.id, input.id));
    return;
  }
  await db
    .update(passwordResets)
    .set({ used: true })
    .where(and(eq(passwordResets.userId, input.userId), eq(passwordResets.used, false), ne(passwordResets.id, input.id)));
}

async function loadValidReset(token: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(passwordResets)
    .where(eq(passwordResets.tokenHash, hashToken(token)))
    .limit(1);
  if (!row || row.used || new Date(row.expires).getTime() < Date.now()) {
    throw new Error("Link inválido ou expirado. Solicite uma nova redefinição de senha.");
  }
  return row;
}

export async function assertPasswordResetToken(token: string): Promise<void> {
  await loadValidReset(token);
}

export async function resetPasswordWithToken(token: string, password: string): Promise<User> {
  assertPassword(password);
  const row = await loadValidReset(token);
  const user = await loadUser(row.userId);
  if (!user || user.status !== "active") {
    throw new Error("Este acesso está desativado.");
  }
  const db = getDb();
  await db.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, row.userId));
  await db
    .update(passwordResets)
    .set({ used: true })
    .where(and(eq(passwordResets.userId, row.userId), eq(passwordResets.used, false)));
  const sessionVersion = await bumpSessionVersion(row.userId);
  await createSession(row.userId, sessionVersion);
  await writeAudit(row.userId, "RESET_PASSWORD", row.userId, "—", "senha redefinida");
  return user;
}

export async function changeOwnPassword(
  actor: User,
  currentPassword: string,
  nextPassword: string,
): Promise<void> {
  assertPassword(nextPassword);
  if (currentPassword === nextPassword) {
    throw new Error("A nova senha deve ser diferente da atual.");
  }
  const db = getDb();
  const [row] = await db.select().from(users).where(eq(users.id, actor.id)).limit(1);
  if (!row || !(await verifyPassword(currentPassword, row.passwordHash))) {
    throw new Error("Senha atual incorreta.");
  }
  await db.update(users).set({ passwordHash: await hashPassword(nextPassword) }).where(eq(users.id, actor.id));
  await writeAudit(actor.id, "CHANGE_PASSWORD", actor.id, "—", "senha atualizada");
  const sessionVersion = await bumpSessionVersion(actor.id);
  await createSession(actor.id, sessionVersion);
}

export async function findCompanyRow(id: string): Promise<Company | undefined> {
  const [row] = await getDb().select().from(companies).where(eq(companies.id, id)).limit(1);
  return row ? mapCompany(row) : undefined;
}

export async function userCanReadStoredPath(user: User, pathname: string): Promise<boolean> {
  if (pathname.startsWith(`romflow/${user.id}/`)) {
    return true;
  }
  const proxyUrl = fileProxyUrl(pathname);
  const urlSuffix = `%/${pathname}`;
  const rows = await getDb()
    .select()
    .from(expenses)
    .where(
      or(
        sql`coalesce(${expenses.receipt} ->> 'pathname', '') = ${pathname}`,
        sql`coalesce(${expenses.paymentProof} ->> 'pathname', '') = ${pathname}`,
        sql`coalesce(${expenses.receipt} ->> 'url', '') = ${proxyUrl}`,
        sql`coalesce(${expenses.paymentProof} ->> 'url', '') = ${proxyUrl}`,
        sql`coalesce(${expenses.receipt} ->> 'url', '') like ${urlSuffix}`,
        sql`coalesce(${expenses.paymentProof} ->> 'url', '') like ${urlSuffix}`,
      ),
    );
  return rows.some(
    (row) =>
      (storedFileGrantsPathname(row.receipt, pathname) || storedFileGrantsPathname(row.paymentProof, pathname)) &&
      canSeeExpense(user, mapExpense(row)),
  );
}
