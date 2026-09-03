import { and, desc, eq, inArray } from "drizzle-orm";
import { canAccessCompany } from "@/lib/access";
import { getDb } from "@/lib/db";
import { uid, inviteToken } from "@/lib/db/ids";
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
} from "@/lib/db/schema";
import type {
  AuditAction,
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
  canSeeExpense,
  defaultAreasForRole,
  initialStatus,
  isMaster,
  nextStatus,
  parseArea,
  parseAreas,
  parseExpenseType,
  parseRole,
  parseStatus,
  validateEventDate,
  validatePaymentDate,
  withEventDateObservation,
} from "@/lib/workflow";
import { persistStoredFile, publicStoredFile } from "@/lib/server/blob";
import { PERSONAL_BUSINESS_IDS } from "@/lib/seed";
import { assertPassword, createSession, hashPassword, loadUser, userCount, verifyPassword } from "@/lib/server/session";

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

async function resolveCompanyIds(companyIds: string[]): Promise<string[]> {
  const unique = [...new Set(companyIds.filter(Boolean))];
  if (unique.length === 0) {
    throw new Error("Selecione ao menos uma empresa.");
  }
  const rows = await getDb().select({ id: companies.id }).from(companies);
  const valid = new Set(rows.map((row) => row.id));
  const resolved = unique.filter((id) => valid.has(id));
  if (resolved.length === 0) {
    throw new Error("Selecione ao menos uma empresa válida.");
  }
  return resolved;
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

export async function listNotificationRecipients(
  companyId: string,
  requesterId: string,
  area: RequestArea,
): Promise<User[]> {
  const all = await loadAllUsers();
  const seen = new Set<string>();
  const recipients: User[] = [];
  for (const user of all) {
    if (user.status !== "active") {
      continue;
    }
    const isRequester = user.id === requesterId;
    const watches =
      user.companyIds.includes(companyId) &&
      (isMaster(user.role) || (canAccessArea(user, area) && user.role !== "solicitante"));
    if (!isRequester && !watches) {
      continue;
    }
    const key = user.email.trim().toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    recipients.push(user);
  }
  return recipients;
}

function mapEmailLog(row: typeof emailLogs.$inferSelect): EmailLog {
  const role = row.toRole;
  const kind = row.kind;
  return {
    id: row.id,
    kind: kind === "invite" || kind === "expense_created" || kind === "expense_status" ? kind : "expense_status",
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

export async function getSnapshot(actor: User): Promise<Database> {
  const db = getDb();
  const companyRows = await db.select().from(companies);
  const categoryRows = await db.select().from(categories);
  const expenseRows = await db.select().from(expenses).orderBy(desc(expenses.created));
  const allUsers = actor.role === "solicitante" ? [actor] : await loadAllUsers();
  const allInvites = isMaster(actor.role) ? await loadInvitations() : [];
  const logs = isMaster(actor.role)
    ? await db.select().from(auditLogs).orderBy(desc(auditLogs.created))
    : [];

  const visibleCompanies = isMaster(actor.role)
    ? companyRows
    : companyRows.filter((item) => actor.companyIds.includes(item.id));

  const visibleExpenses = expenseRows
    .map(mapExpense)
    .filter((item) => canSeeExpense(actor, item));

  const visibleUsers = usersForSnapshot(actor, allUsers, visibleExpenses);

  const mailRows = isMaster(actor.role)
    ? await db.select().from(emailLogs).orderBy(desc(emailLogs.created))
    : [];

  return {
    revision: 1,
    companies: visibleCompanies.map(mapCompany),
    categories: categoryRows.map(mapCategory),
    users: visibleUsers,
    invitations: allInvites,
    expenses: visibleExpenses,
    auditLogs: logs.map((item) => ({
      id: item.id,
      user: item.userId,
      action: item.action as AuditAction,
      resource: item.resource,
      before: item.before,
      after: item.after,
      created: item.created,
    })),
    emailLogs: mailRows.map(mapEmailLog),
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
  if (!canAccessArea(actor, input.area)) {
    throw new Error("Você não tem acesso a esta área de solicitação.");
  }
  if (input.area === "financeiro") {
    validatePaymentDate(input.expense_type, input.max_payment_date, input.payment_date_justification);
    validateEventDate(input.expense_type, input.event_date);
  }
  const created = new Date().toISOString();
  const receipt = await persistStoredFile(input.receipt, "receipts");
  const expense: Expense = {
    ...input,
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
  const paymentProof = await persistStoredFile(payload?.proof ?? current.payment_proof, "proofs");
  const receipt = await persistStoredFile(payload?.receipt ?? current.receipt, "receipts");
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
  await db
    .update(expenses)
    .set({
      status: updated.status,
      approverId: updated.approver,
      reviewNote: updated.review_note,
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
  areaIds: RequestArea[],
): Promise<Invitation> {
  if (!isMaster(actor.role)) {
    throw new Error("Apenas o master pode criar acessos.");
  }
  const normalized = email.trim().toLowerCase();
  const resolvedRole = parseRole(role);
  const resolvedCompanies = await resolveCompanyIds(companyIds);
  const resolvedAreas = defaultAreasForRole(resolvedRole, areaIds);
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

export async function acceptInvitation(token: string, name: string, password: string): Promise<User> {
  assertPassword(password);
  const invitation = await getInvitationByToken(token);
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
    const adminRows = await db.select({ id: users.id, role: users.role }).from(users);
    const masters = adminRows.filter((item) => parseRole(item.role) === "master");
    if (masters.length <= 1) {
      throw new Error("É preciso manter ao menos um master.");
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
  const resolvedCompanies = await resolveCompanyIds(companyIds);
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

export async function revokeUserAccessRecord(actor: User, userId: string): Promise<void> {
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
    const adminRows = await db.select({ id: users.id, role: users.role, status: users.status }).from(users);
    const otherMasters = adminRows.filter(
      (item) => item.id !== userId && item.status === "active" && parseRole(item.role) === "master",
    );
    if (otherMasters.length === 0) {
      throw new Error("É preciso manter ao menos um master ativo.");
    }
  }
  await db.update(users).set({ status: "inactive" }).where(eq(users.id, userId));
  await writeAudit(actor.id, "REVOKE_USER", userId, row.status, "inactive");
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

export async function findCompanyRow(id: string): Promise<Company | undefined> {
  const [row] = await getDb().select().from(companies).where(eq(companies.id, id)).limit(1);
  return row ? mapCompany(row) : undefined;
}
