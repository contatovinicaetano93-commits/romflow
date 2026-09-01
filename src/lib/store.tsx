"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { SEED, SEED_REVISION } from "./seed";
import type {
  AuditAction,
  Category,
  Company,
  Database,
  Expense,
  ExpenseStatus,
  Invitation,
  Role,
  StoredFile,
  User,
} from "./types";

/** Client persistence. Swap readDb/writeDb for a remote database when plugging one in. */
const DB_KEY = "romflow-db-v6";
const SESSION_KEY = "romflow-session";
const LEGACY_DB_KEYS = ["romflow-db", "romflow-db-v2", "romflow-db-v3", "romflow-db-v4", "romflow-db-v5"];

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function cloneSeed(): Database {
  return structuredClone(SEED);
}

function clearLegacyStorage() {
  if (typeof window === "undefined") {
    return;
  }
  for (const key of LEGACY_DB_KEYS) {
    window.localStorage.removeItem(key);
  }
}

function readDb(): Database {
  if (typeof window === "undefined") {
    return cloneSeed();
  }
  clearLegacyStorage();
  try {
    const raw = window.localStorage.getItem(DB_KEY);
    if (!raw) {
      return cloneSeed();
    }
    const parsed = JSON.parse(raw) as Database;
    if (parsed.revision !== SEED_REVISION || !parsed.users?.length || !parsed.companies?.length) {
      return cloneSeed();
    }
    return {
      ...parsed,
      expenses: parsed.expenses ?? [],
      invitations: parsed.invitations ?? [],
      auditLogs: parsed.auditLogs ?? [],
    };
  } catch {
    return cloneSeed();
  }
}

function writeDb(db: Database) {
  window.localStorage.setItem(DB_KEY, JSON.stringify(db));
}

let clientDb: Database | null = null;
let sessionId: string | null | undefined;
const dbListeners = new Set<() => void>();
const sessionListeners = new Set<() => void>();

function subscribeDb(listener: () => void) {
  dbListeners.add(listener);
  return () => {
    dbListeners.delete(listener);
  };
}

function subscribeSession(listener: () => void) {
  sessionListeners.add(listener);
  return () => {
    sessionListeners.delete(listener);
  };
}

function getDbSnapshot(): Database {
  if (!clientDb) {
    clientDb = readDb();
    writeDb(clientDb);
  }
  return clientDb;
}

function getSessionSnapshot(): string | null {
  if (sessionId === undefined) {
    sessionId = window.localStorage.getItem(SESSION_KEY);
  }
  return sessionId;
}

function persistDb(next: Database) {
  const stamped: Database = { ...next, revision: SEED_REVISION };
  clientDb = stamped;
  writeDb(stamped);
  dbListeners.forEach((listener) => listener());
}

function persistSession(id: string | null) {
  sessionId = id;
  if (id) {
    window.localStorage.setItem(SESSION_KEY, id);
  } else {
    window.localStorage.removeItem(SESSION_KEY);
  }
  sessionListeners.forEach((listener) => listener());
}

const SERVER_DB = SEED;
const SERVER_SESSION: string | null = null;

function getServerDb(): Database {
  return SERVER_DB;
}

function getServerSession(): string | null {
  return SERVER_SESSION;
}

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

type StoreValue = {
  db: Database;
  user: User | null;
  company: Company | null;
  login: (email: string, password: string) => Promise<User>;
  bootstrapAdmin: (name: string, email: string, password: string) => User;
  logout: () => void;
  selectCompany: (id: string) => void;
  switchCompany: () => void;
  accessibleCompanies: () => Company[];
  companyExpenses: (companyId?: string) => Expense[];
  createExpense: (expense: Omit<Expense, "id" | "created" | "updated">) => Expense;
  applyFinanceAction: (
    expenseId: string,
    action: FinanceAction,
    payload?: FinanceActionPayload,
  ) => void;
  inviteUser: (email: string, role: Role, companyIds: string[]) => Invitation;
  validateInvite: (token: string) => Invitation;
  acceptInvite: (token: string, name: string, password: string) => User;
  toggleUserStatus: (userId: string) => void;
  createCompany: (input: { name: string; color: string }) => void;
  createCategory: (input: { name: string; color: string }) => void;
  updateCategory: (id: string, patch: Partial<Category>) => void;
  findUser: (id: string) => User | undefined;
  findCompany: (id: string) => Company | undefined;
};

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const db = useSyncExternalStore(subscribeDb, getDbSnapshot, getServerDb);
  const session = useSyncExternalStore(subscribeSession, getSessionSnapshot, getServerSession);
  const user = db.users.find((item) => item.id === session) ?? null;
  const [company, setCompany] = useState<Company | null>(null);

  const persist = useCallback((next: Database) => {
    persistDb(next);
  }, []);

  const log = useCallback(
    (
      current: Database,
      actorId: string,
      action: AuditAction,
      resource: string,
      before: string,
      after: string,
    ): Database => ({
      ...current,
      auditLogs: [
        {
          id: uid("aud"),
          user: actorId,
          action,
          resource,
          before,
          after,
          created: new Date().toISOString(),
        },
        ...current.auditLogs,
      ],
    }),
    [],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const match = db.users.find(
        (item) =>
          item.email.toLowerCase() === email.trim().toLowerCase() &&
          item.password === password,
      );
      if (!match) {
        throw new Error("Failed to authenticate.");
      }
      if (match.status !== "active") {
        throw new Error("Este acesso está desativado. Fale com o administrador.");
      }
      persistSession(match.id);
      setCompany(null);
      return match;
    },
    [db.users],
  );

  const bootstrapAdmin = useCallback(
    (name: string, email: string, password: string) => {
      if (db.users.length > 0) {
        throw new Error("Já existe um acesso cadastrado.");
      }
      const created = new Date().toISOString();
      const admin: User = {
        id: uid("usr"),
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role: "admin",
        status: "active",
        companyIds: db.companies.map((item) => item.id),
        created,
      };
      persist({ ...db, users: [admin] });
      persistSession(admin.id);
      setCompany(null);
      return admin;
    },
    [db, persist],
  );

  const logout = useCallback(() => {
    persistSession(null);
    setCompany(null);
  }, []);

  const selectCompany = useCallback(
    (id: string) => {
      const selected = db.companies.find((item) => item.id === id) ?? null;
      setCompany(selected);
    },
    [db.companies],
  );

  const switchCompany = useCallback(() => {
    setCompany(null);
  }, []);

  const accessibleCompanies = useCallback(() => {
    if (!user) {
      return [];
    }
    const active = db.companies.filter((item) => item.is_active);
    if (user.role === "admin" || user.role === "financeiro") {
      return active;
    }
    return active.filter((item) => user.companyIds.includes(item.id));
  }, [db.companies, user]);

  const companyExpenses = useCallback(
    (companyId?: string) => {
      const id = companyId ?? company?.id;
      if (!id) {
        return [];
      }
      return db.expenses
        .filter((item) => item.company === id)
        .sort((a, b) => b.created.localeCompare(a.created));
    },
    [company?.id, db.expenses],
  );

  const createExpense = useCallback(
    (input: Omit<Expense, "id" | "created" | "updated">) => {
      if (!user) {
        throw new Error("Sessão expirada.");
      }
      const created = new Date().toISOString();
      const expense: Expense = {
        ...input,
        id: uid("exp"),
        created,
        updated: created,
      };
      persist(
        log(
          { ...db, expenses: [expense, ...db.expenses] },
          user.id,
          "CREATE_EXPENSE",
          expense.id,
          "—",
          "enviada",
        ),
      );
      return expense;
    },
    [db, log, persist, user],
  );

  const applyFinanceAction = useCallback(
    (
      expenseId: string,
      action: FinanceAction,
      payload?: FinanceActionPayload,
    ) => {
      if (!user) {
        throw new Error("Sessão expirada.");
      }
      const current = db.expenses.find((item) => item.id === expenseId);
      if (!current) {
        throw new Error("Solicitação não encontrada.");
      }
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
        approver: action === "resubmit" ? current.approver : user.id,
        review_note: payload?.note ?? current.review_note,
        scheduled_date:
          action === "schedule" ? (payload?.scheduledDate ?? current.scheduled_date) : current.scheduled_date,
        payment_proof: payload?.proof ?? current.payment_proof,
        receipt: payload?.receipt ?? current.receipt,
        updated: new Date().toISOString(),
      };
      persist(
        log(
          {
            ...db,
            expenses: db.expenses.map((item) => (item.id === expenseId ? updated : item)),
          },
          user.id,
          audit,
          expenseId,
          current.status,
          status,
        ),
      );
    },
    [db, log, persist, user],
  );

  const inviteUser = useCallback(
    (email: string, role: Role, companyIds: string[]) => {
      if (!user) {
        throw new Error("Sessão expirada.");
      }
      const invitation: Invitation = {
        id: uid("inv"),
        email: email.trim().toLowerCase(),
        role,
        companyIds,
        token: uid("token"),
        invitedBy: user.id,
        created: new Date().toISOString(),
        expires: new Date(Date.now() + 30 * 86_400_000).toISOString(),
        accepted: false,
      };
      persist({ ...db, invitations: [invitation, ...db.invitations] });
      return invitation;
    },
    [db, persist, user],
  );

  const validateInvite = useCallback(
    (token: string) => {
      const invitation = db.invitations.find((item) => item.token === token);
      if (!invitation || invitation.accepted) {
        throw new Error("Convite inválido ou expirado. Solicite um novo convite ao administrador.");
      }
      if (new Date(invitation.expires).getTime() < Date.now()) {
        throw new Error("Convite expirado. Solicite um novo convite ao administrador.");
      }
      return invitation;
    },
    [db.invitations],
  );

  const acceptInvite = useCallback(
    (token: string, name: string, password: string) => {
      const invitation = validateInvite(token);
      const created = new Date().toISOString();
      const nextUser: User = {
        id: uid("usr"),
        name,
        email: invitation.email,
        password,
        role: invitation.role,
        status: "active",
        companyIds: invitation.companyIds,
        created,
      };
      persist({
        ...db,
        users: [nextUser, ...db.users],
        invitations: db.invitations.map((item) =>
          item.id === invitation.id ? { ...item, accepted: true } : item,
        ),
      });
      persistSession(nextUser.id);
      return nextUser;
    },
    [db, persist, validateInvite],
  );

  const toggleUserStatus = useCallback(
    (userId: string) => {
      persist({
        ...db,
        users: db.users.map((item) =>
          item.id === userId
            ? { ...item, status: item.status === "active" ? "inactive" : "active" }
            : item,
        ),
      });
    },
    [db, persist],
  );

  const createCompany = useCallback(
    (input: { name: string; color: string }) => {
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
      persist({ ...db, companies: [...db.companies, companyItem] });
    },
    [db, persist],
  );

  const createCategory = useCallback(
    (input: { name: string; color: string }) => {
      persist({
        ...db,
        categories: [
          ...db.categories,
          { id: uid("cat"), name: input.name, color: input.color, is_active: true },
        ],
      });
    },
    [db, persist],
  );

  const updateCategory = useCallback(
    (id: string, patch: Partial<Category>) => {
      persist({
        ...db,
        categories: db.categories.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      });
    },
    [db, persist],
  );

  const findUser = useCallback(
    (id: string) => db.users.find((item) => item.id === id),
    [db.users],
  );

  const findCompany = useCallback(
    (id: string) => db.companies.find((item) => item.id === id),
    [db.companies],
  );

  const value = useMemo<StoreValue>(
    () => ({
      db,
      user,
      company,
      login,
      bootstrapAdmin,
      logout,
      selectCompany,
      switchCompany,
      accessibleCompanies,
      companyExpenses,
      createExpense,
      applyFinanceAction,
      inviteUser,
      validateInvite,
      acceptInvite,
      toggleUserStatus,
      createCompany,
      createCategory,
      updateCategory,
      findUser,
      findCompany,
    }),
    [
      acceptInvite,
      accessibleCompanies,
      applyFinanceAction,
      bootstrapAdmin,
      company,
      companyExpenses,
      createCategory,
      createCompany,
      createExpense,
      db,
      findCompany,
      findUser,
      inviteUser,
      login,
      logout,
      selectCompany,
      switchCompany,
      toggleUserStatus,
      updateCategory,
      user,
      validateInvite,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) {
    throw new Error("useStore must be used within StoreProvider");
  }
  return value;
}
