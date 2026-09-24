"use client";

import * as Sentry from "@sentry/nextjs";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { canAccessCompany } from "./access";
import type {
  Category,
  Company,
  Database,
  Expense,
  FinanceAction,
  FinanceActionPayload,
  Invitation,
  RequestArea,
  Role,
  User,
} from "./types";

export type { FinanceAction, FinanceActionPayload };

type CompanyWorkset = {
  expenses: Expense[];
  users: User[];
};

type OpsSnapshot = {
  auditLogs: Database["auditLogs"];
  emailLogs: Database["emailLogs"];
};

type SessionPayload = {
  user: User | null;
  needsSetup: boolean;
  snapshot?: Database | null;
};

const EMPTY_DB: Database = {
  revision: 1,
  companies: [],
  categories: [],
  users: [],
  invitations: [],
  expenses: [],
  auditLogs: [],
  emailLogs: [],
};

function syncSentryUser(user: User | null) {
  if (!user) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({ id: user.id, email: user.email, username: user.name });
}

const PUBLIC_AUTH_PATHS = [
  "/api/auth/login",
  "/api/auth/forgot",
  "/api/auth/reset",
  "/api/bootstrap",
  "/api/invitations/validate",
  "/api/invitations/accept",
];

let onUnauthorized: (() => void) | null = null;

function isPublicAuthPath(path: string): boolean {
  const pathname = path.split("?")[0] ?? path;
  return PUBLIC_AUTH_PATHS.some((item) => pathname === item);
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const url =
    method === "GET"
      ? `${path}${path.includes("?") ? "&" : "?"}_ts=${Date.now()}`
      : path;
  const controller = new AbortController();
  const timeoutMs = method === "GET" ? 20_000 : 45_000;
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      method,
      cache: "no-store",
      credentials: "include",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        ...(init?.headers ?? {}),
      },
    });
    const body = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) {
      if (res.status === 401 && !isPublicAuthPath(path)) {
        onUnauthorized?.();
      }
      throw new Error(body.error || "Não foi possível concluir a operação.");
    }
    return body;
  } catch (caught) {
    if (caught instanceof DOMException && caught.name === "AbortError") {
      throw new Error("A conexão demorou demais. Verifique a internet e tente de novo.");
    }
    throw caught;
  } finally {
    window.clearTimeout(timeout);
  }
}

function mergeUsers(current: User[], incoming: User[]): User[] {
  if (incoming.length === 0) {
    return current;
  }
  const next = new Map(current.map((item) => [item.id, item]));
  for (const user of incoming) {
    next.set(user.id, user);
  }
  return [...next.values()];
}

function patchUser(current: Database, user: User): Database {
  return {
    ...current,
    users: current.users.some((item) => item.id === user.id)
      ? current.users.map((item) => (item.id === user.id ? user : item))
      : [...current.users, user],
    invitations:
      user.status === "inactive"
        ? current.invitations.filter(
            (item) => item.accepted || item.email.trim().toLowerCase() !== user.email.trim().toLowerCase(),
          )
        : current.invitations,
  };
}

type StoreValue = {
  ready: boolean;
  needsSetup: boolean;
  db: Database;
  user: User | null;
  company: Company | null;
  pickerInbox: Expense[];
  workingCompanyId: string | null;
  login: (email: string, password: string) => Promise<User>;
  bootstrapAdmin: (name: string, email: string, password: string) => Promise<User>;
  requestPasswordReset: (email: string) => Promise<void>;
  changePassword: (currentPassword: string, nextPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  selectCompany: (id: string) => Promise<void>;
  switchCompany: () => void;
  reload: () => Promise<void>;
  loadOps: () => Promise<void>;
  accessibleCompanies: () => Company[];
  companyExpenses: (companyId?: string) => Expense[];
  createExpense: (expense: Omit<Expense, "id" | "created" | "updated">) => Promise<Expense>;
  applyFinanceAction: (
    expenseId: string,
    action: FinanceAction,
    payload?: FinanceActionPayload,
  ) => Promise<void>;
  inviteUser: (
    email: string,
    role: Role,
    companyIds: string[],
    areaIds: string[],
  ) => Promise<Invitation & { emailSent: boolean; emailError?: string }>;
  validateInvite: (token: string) => Promise<{ invitation: Invitation; companies: Company[] }>;
  acceptInvite: (token: string, name: string, password: string) => Promise<User>;
  toggleUserStatus: (userId: string) => Promise<void>;
  revokeUserAccess: (userId: string) => Promise<void>;
  cancelInvitation: (invitationId: string) => Promise<void>;
  updateUserAccess: (
    userId: string,
    role: Role,
    companyIds: string[],
    areaIds: RequestArea[],
  ) => Promise<void>;
  updateInvitationAccess: (
    invitationId: string,
    role: Role,
    companyIds: string[],
    areaIds: RequestArea[],
  ) => Promise<void>;
  createCompany: (input: { name: string; color: string }) => Promise<void>;
  updateCompanyStatus: (companyId: string, isActive: boolean) => Promise<void>;
  createCategory: (input: { name: string; color: string }) => Promise<void>;
  updateCategory: (id: string, patch: Partial<Category>) => Promise<void>;
  findUser: (id: string) => User | undefined;
  findCompany: (id: string) => Company | undefined;
  notice: string | null;
  clearNotice: () => void;
};

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [db, setDb] = useState<Database>(EMPTY_DB);
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [pickerInbox, setPickerInbox] = useState<Expense[]>([]);
  const [workingCompanyId, setWorkingCompanyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const selectSeq = useRef(0);

  useEffect(() => {
    onUnauthorized = () => {
      setUser(null);
      syncSentryUser(null);
      setCompany(null);
      setWorkingCompanyId(null);
      setPickerInbox([]);
      setDb(EMPTY_DB);
      setNotice("Sessão expirada. Entre de novo.");
    };
    return () => {
      onUnauthorized = null;
    };
  }, []);

  const applyBootstrap = useCallback((snapshot: Database | null | undefined): boolean => {
    if (snapshot) {
      setPickerInbox(snapshot.expenses);
      setDb((current) => ({
        revision: snapshot.revision,
        companies: snapshot.companies,
        categories: snapshot.categories,
        users: snapshot.users,
        invitations: snapshot.invitations,
        expenses: current.expenses,
        auditLogs: current.auditLogs,
        emailLogs: current.emailLogs,
      }));
      return true;
    }
    if (snapshot === null) {
      setPickerInbox([]);
      setDb(EMPTY_DB);
      return true;
    }
    return false;
  }, []);

  const refreshDirectory = useCallback(async (nextUser?: User | null) => {
    const active = nextUser === undefined ? user : nextUser;
    if (!active) {
      setPickerInbox([]);
      setDb(EMPTY_DB);
      return;
    }
    const snapshot = await api<Database>("/api/data?scope=bootstrap");
    applyBootstrap(snapshot);
  }, [applyBootstrap, user]);

  const refreshCompany = useCallback(async (companyId: string) => {
    const data = await api<CompanyWorkset>(
      `/api/data?scope=company&companyId=${encodeURIComponent(companyId)}`,
    );
    setDb((current) => ({
      ...current,
      expenses: data.expenses,
      users: mergeUsers(current.users, data.users),
    }));
    setWorkingCompanyId(companyId);
  }, []);

  const loadOps = useCallback(async () => {
    if (!user) {
      return;
    }
    const data = await api<OpsSnapshot>("/api/data?scope=ops");
    setDb((current) => ({
      ...current,
      auditLogs: data.auditLogs,
      emailLogs: data.emailLogs,
    }));
  }, [user]);

  const settleUser = useCallback(
    async (nextUser: User, snapshot?: Database | null) => {
      setUser(nextUser);
      syncSentryUser(nextUser);
      setCompany(null);
      setWorkingCompanyId(null);
      setNeedsSetup(false);
      if (applyBootstrap(snapshot)) {
        return;
      }
      try {
        await refreshDirectory(nextUser);
      } catch {
        setPickerInbox([]);
        setDb(EMPTY_DB);
      }
    },
    [applyBootstrap, refreshDirectory],
  );

  const reload = useCallback(async () => {
    const session = await api<SessionPayload>("/api/auth/session");
    setNeedsSetup(session.needsSetup);
    setUser(session.user);
    syncSentryUser(session.user);
    if (!session.user) {
      setCompany(null);
      setWorkingCompanyId(null);
      setPickerInbox([]);
      setDb(EMPTY_DB);
      return;
    }
    const currentCompany = company;
    if (currentCompany && !canAccessCompany(session.user, currentCompany.id)) {
      setCompany(null);
      setWorkingCompanyId(null);
    }
    if (!applyBootstrap(session.snapshot)) {
      try {
        await refreshDirectory(session.user);
      } catch {
        setPickerInbox([]);
        setDb(EMPTY_DB);
      }
    }
    const nextCompany =
      currentCompany && canAccessCompany(session.user, currentCompany.id) ? currentCompany : null;
    if (nextCompany) {
      try {
        await refreshCompany(nextCompany.id);
      } catch {
        setWorkingCompanyId(nextCompany.id);
      }
    }
    try {
      const data = await api<OpsSnapshot>("/api/data?scope=ops");
      setDb((current) => ({
        ...current,
        auditLogs: data.auditLogs,
        emailLogs: data.emailLogs,
      }));
    } catch {
      return;
    }
  }, [applyBootstrap, company, refreshCompany, refreshDirectory]);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        const session = await api<SessionPayload>("/api/auth/session");
        if (cancelled) {
          return;
        }
        setNeedsSetup(session.needsSetup);
        setUser(session.user);
        syncSentryUser(session.user);
        if (applyBootstrap(session.snapshot)) {
          return;
        }
        if (session.user) {
          try {
            const snapshot = await api<Database>("/api/data?scope=bootstrap");
            if (!cancelled) {
              applyBootstrap(snapshot);
            }
          } catch {
            if (!cancelled) {
              setPickerInbox([]);
              setDb(EMPTY_DB);
            }
          }
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          syncSentryUser(null);
          setPickerInbox([]);
          setDb(EMPTY_DB);
        }
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, [applyBootstrap]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api<{ user: User; snapshot?: Database | null }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    await settleUser(result.user, result.snapshot);
    return result.user;
  }, [settleUser]);

  const bootstrapAdmin = useCallback(async (name: string, email: string, password: string) => {
    const result = await api<{ user: User; snapshot?: Database | null }>("/api/bootstrap", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
    await settleUser(result.user, result.snapshot);
    return result.user;
  }, [settleUser]);

  const requestPasswordReset = useCallback(async (email: string) => {
    await api("/api/auth/forgot", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }, []);

  const changePassword = useCallback(async (currentPassword: string, nextPassword: string) => {
    await api("/api/auth/password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, password: nextPassword }),
    });
  }, []);

  const logout = useCallback(async () => {
    await api("/api/auth/logout", { method: "POST" });
    setUser(null);
    syncSentryUser(null);
    setCompany(null);
    setWorkingCompanyId(null);
    setPickerInbox([]);
    setDb(EMPTY_DB);
  }, []);

  const selectCompany = useCallback(
    async (id: string) => {
      if (!user || !canAccessCompany(user, id)) {
        return;
      }
      const next = db.companies.find((item) => item.id === id);
      if (!next?.is_active) {
        return;
      }
      const seq = ++selectSeq.current;
      setCompany(next);
      try {
        const data = await api<CompanyWorkset>(
          `/api/data?scope=company&companyId=${encodeURIComponent(id)}`,
        );
        if (seq !== selectSeq.current) {
          return;
        }
        setDb((current) => ({
          ...current,
          expenses: data.expenses,
          users: mergeUsers(current.users, data.users),
        }));
        setWorkingCompanyId(id);
      } catch (caught) {
        if (seq !== selectSeq.current) {
          return;
        }
        setWorkingCompanyId(id);
        setNotice(
          caught instanceof Error ? caught.message : "Não foi possível carregar as solicitações.",
        );
      }
    },
    [db.companies, user],
  );

  const switchCompany = useCallback(() => {
    setCompany(null);
  }, []);

  const accessibleCompanies = useCallback(() => {
    if (!user) {
      return [];
    }
    return db.companies.filter((item) => item.is_active && canAccessCompany(user, item.id));
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
    async (input: Omit<Expense, "id" | "created" | "updated">) => {
      const result = await api<{ expense: Expense; emailSent?: boolean; emailError?: string }>(
        "/api/expenses",
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      );
      if (result.emailError) {
        setNotice(`Solicitação salva, mas o e-mail não saiu: ${result.emailError}`);
      } else {
        setNotice(null);
      }
      setDb((current) => ({
        ...current,
        expenses: [result.expense, ...current.expenses.filter((item) => item.id !== result.expense.id)],
      }));
      if (input.company) {
        void refreshCompany(input.company).catch(() => undefined);
      }
      return result.expense;
    },
    [refreshCompany],
  );

  const applyFinanceAction = useCallback(
    async (expenseId: string, action: FinanceAction, payload?: FinanceActionPayload) => {
      const result = await api<{ expense: Expense; emailSent?: boolean; emailError?: string }>(
        "/api/expenses/action",
        {
          method: "POST",
          body: JSON.stringify({ expenseId, action, payload }),
        },
      );
      if (result.emailError) {
        setNotice(`Movimentação salva, mas o e-mail não saiu: ${result.emailError}`);
      } else {
        setNotice(null);
      }
      setDb((current) => ({
        ...current,
        expenses: current.expenses.map((item) => (item.id === result.expense.id ? result.expense : item)),
      }));
      const companyId = result.expense.company;
      if (companyId) {
        void refreshCompany(companyId).catch(() => undefined);
      }
    },
    [refreshCompany],
  );

  const inviteUser = useCallback(
    async (email: string, role: Role, companyIds: string[], areaIds: string[]) => {
      const result = await api<{
        invitation: Invitation;
        emailSent: boolean;
        emailError?: string;
      }>("/api/invitations", {
        method: "POST",
        body: JSON.stringify({ email, role, companyIds, areaIds }),
      });
      setDb((current) => ({
        ...current,
        invitations: [
          result.invitation,
          ...current.invitations.filter((item) => item.id !== result.invitation.id),
        ],
      }));
      return { ...result.invitation, emailSent: result.emailSent, emailError: result.emailError };
    },
    [],
  );

  const validateInvite = useCallback(async (token: string) => {
    return api<{ invitation: Invitation; companies: Company[] }>(
      `/api/invitations/validate?token=${encodeURIComponent(token)}`,
    );
  }, []);

  const acceptInvite = useCallback(
    async (token: string, name: string, password: string) => {
      const result = await api<{ user: User }>("/api/invitations/accept", {
        method: "POST",
        body: JSON.stringify({ token, name, password }),
      });
      await settleUser(result.user);
      return result.user;
    },
    [settleUser],
  );

  const toggleUserStatus = useCallback(async (userId: string) => {
    const result = await api<{ user: User }>("/api/users/toggle", {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
    setDb((current) => patchUser(current, result.user));
  }, []);

  const revokeUserAccess = useCallback(async (userId: string) => {
    const result = await api<{ user: User }>("/api/users/revoke", {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
    setDb((current) => patchUser(current, result.user));
  }, []);

  const cancelInvitation = useCallback(async (invitationId: string) => {
    await api("/api/invitations/cancel", {
      method: "POST",
      body: JSON.stringify({ invitationId }),
    });
    setDb((current) => ({
      ...current,
      invitations: current.invitations.filter((item) => item.id !== invitationId),
    }));
  }, []);

  const updateUserAccess = useCallback(
    async (userId: string, role: Role, companyIds: string[], areaIds: RequestArea[]) => {
      const result = await api<{ user: User }>("/api/users", {
        method: "PATCH",
        body: JSON.stringify({ userId, role, companyIds, areaIds }),
      });
      if (user?.id === userId) {
        setUser(result.user);
        syncSentryUser(result.user);
        setCompany((current) =>
          current && canAccessCompany(result.user, current.id) ? current : null,
        );
      }
      setDb((current) => patchUser(current, result.user));
    },
    [user],
  );

  const updateInvitationAccess = useCallback(
    async (invitationId: string, role: Role, companyIds: string[], areaIds: RequestArea[]) => {
      const result = await api<{ invitation: Invitation }>("/api/invitations", {
        method: "PATCH",
        body: JSON.stringify({ invitationId, role, companyIds, areaIds }),
      });
      setDb((current) => ({
        ...current,
        invitations: current.invitations.map((item) =>
          item.id === result.invitation.id ? result.invitation : item,
        ),
      }));
    },
    [],
  );

  const createCompany = useCallback(
    async (input: { name: string; color: string }) => {
      const result = await api<{ company: Company }>("/api/companies", {
        method: "POST",
        body: JSON.stringify(input),
      });
      setUser((current) =>
        current && !current.companyIds.includes(result.company.id)
          ? { ...current, companyIds: [...current.companyIds, result.company.id] }
          : current,
      );
      setDb((current) => ({
        ...current,
        companies: [...current.companies.filter((item) => item.id !== result.company.id), result.company],
      }));
      setCompany(result.company);
      void refreshCompany(result.company.id).catch(() => {
        setWorkingCompanyId(result.company.id);
      });
    },
    [refreshCompany],
  );

  const updateCompanyStatus = useCallback(async (companyId: string, isActive: boolean) => {
    await api("/api/companies", {
      method: "PATCH",
      body: JSON.stringify({ companyId, isActive }),
    });
    setDb((current) => ({
      ...current,
      companies: current.companies.map((item) =>
        item.id === companyId ? { ...item, is_active: isActive } : item,
      ),
    }));
    setCompany((current) =>
      current?.id === companyId ? { ...current, is_active: isActive } : current,
    );
  }, []);

  const createCategory = useCallback(async (input: { name: string; color: string }) => {
    const result = await api<{ category: Category }>("/api/categories", {
      method: "POST",
      body: JSON.stringify(input),
    });
    setDb((current) => ({
      ...current,
      categories: [...current.categories, result.category],
    }));
  }, []);

  const updateCategory = useCallback(async (id: string, patch: Partial<Category>) => {
    const result = await api<{ category: Category }>("/api/categories", {
      method: "PATCH",
      body: JSON.stringify({ id, patch }),
    });
    setDb((current) => ({
      ...current,
      categories: current.categories.map((item) => (item.id === result.category.id ? result.category : item)),
      expenses:
        patch.name && patch.name !== current.categories.find((item) => item.id === id)?.name
          ? current.expenses.map((item) =>
              item.category === current.categories.find((category) => category.id === id)?.name
                ? { ...item, category: result.category.name }
                : item,
            )
          : current.expenses,
    }));
  }, []);

  const findUser = useCallback((id: string) => db.users.find((item) => item.id === id), [db.users]);
  const findCompany = useCallback(
    (id: string) => db.companies.find((item) => item.id === id),
    [db.companies],
  );
  const clearNotice = useCallback(() => {
    setNotice(null);
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      ready,
      needsSetup,
      db,
      user,
      company,
      pickerInbox,
      workingCompanyId,
      login,
      bootstrapAdmin,
      requestPasswordReset,
      changePassword,
      logout,
      selectCompany,
      switchCompany,
      reload,
      loadOps,
      accessibleCompanies,
      companyExpenses,
      createExpense,
      applyFinanceAction,
      inviteUser,
      validateInvite,
      acceptInvite,
      toggleUserStatus,
      revokeUserAccess,
      cancelInvitation,
      updateUserAccess,
      updateInvitationAccess,
      createCompany,
      updateCompanyStatus,
      createCategory,
      updateCategory,
      findUser,
      findCompany,
      notice,
      clearNotice,
    }),
    [
      acceptInvite,
      accessibleCompanies,
      applyFinanceAction,
      bootstrapAdmin,
      cancelInvitation,
      changePassword,
      clearNotice,
      company,
      companyExpenses,
      createCategory,
      createCompany,
      createExpense,
      db,
      findCompany,
      findUser,
      inviteUser,
      loadOps,
      login,
      logout,
      needsSetup,
      notice,
      pickerInbox,
      ready,
      selectCompany,
      switchCompany,
      reload,
      requestPasswordReset,
      revokeUserAccess,
      toggleUserStatus,
      updateCategory,
      updateCompanyStatus,
      updateInvitationAccess,
      updateUserAccess,
      user,
      validateInvite,
      workingCompanyId,
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
