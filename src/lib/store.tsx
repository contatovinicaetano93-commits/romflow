"use client";

import * as Sentry from "@sentry/nextjs";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  Category,
  Company,
  Database,
  Expense,
  FinanceAction,
  FinanceActionPayload,
  Invitation,
  Role,
  User,
} from "./types";

export type { FinanceAction, FinanceActionPayload };

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

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(body.error || "Não foi possível concluir a operação.");
  }
  return body;
}

type StoreValue = {
  ready: boolean;
  needsSetup: boolean;
  db: Database;
  user: User | null;
  company: Company | null;
  login: (email: string, password: string) => Promise<User>;
  bootstrapAdmin: (name: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  selectCompany: (id: string) => void;
  switchCompany: () => void;
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
  ) => Promise<Invitation & { emailSent: boolean; emailError?: string }>;
  validateInvite: (token: string) => Promise<{ invitation: Invitation; companies: Company[] }>;
  acceptInvite: (token: string, name: string, password: string) => Promise<User>;
  toggleUserStatus: (userId: string) => Promise<void>;
  updateUserAccess: (userId: string, role: Role, companyIds: string[]) => Promise<void>;
  updateInvitationAccess: (
    invitationId: string,
    role: Role,
    companyIds: string[],
  ) => Promise<void>;
  createCompany: (input: { name: string; color: string }) => Promise<void>;
  createCategory: (input: { name: string; color: string }) => Promise<void>;
  updateCategory: (id: string, patch: Partial<Category>) => Promise<void>;
  findUser: (id: string) => User | undefined;
  findCompany: (id: string) => Company | undefined;
};

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [db, setDb] = useState<Database>(EMPTY_DB);
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);

  const refreshData = useCallback(async (nextUser?: User | null) => {
    const active = nextUser === undefined ? user : nextUser;
    if (!active) {
      setDb(EMPTY_DB);
      return;
    }
    const snapshot = await api<Database>("/api/data");
    setDb(snapshot);
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        const session = await api<{ user: User | null; needsSetup: boolean }>("/api/auth/session");
        if (cancelled) {
          return;
        }
        setNeedsSetup(session.needsSetup);
        setUser(session.user);
        syncSentryUser(session.user);
        if (session.user) {
          const snapshot = await api<Database>("/api/data");
          if (!cancelled) {
            setDb(snapshot);
          }
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          syncSentryUser(null);
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
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api<{ user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setUser(result.user);
    syncSentryUser(result.user);
    setCompany(null);
    setNeedsSetup(false);
    await refreshData(result.user);
    return result.user;
  }, [refreshData]);

  const bootstrapAdmin = useCallback(async (name: string, email: string, password: string) => {
    const result = await api<{ user: User }>("/api/bootstrap", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
    setUser(result.user);
    syncSentryUser(result.user);
    setCompany(null);
    setNeedsSetup(false);
    await refreshData(result.user);
    return result.user;
  }, [refreshData]);

  const logout = useCallback(async () => {
    await api("/api/auth/logout", { method: "POST" });
    setUser(null);
    syncSentryUser(null);
    setCompany(null);
    setDb(EMPTY_DB);
  }, []);

  const selectCompany = useCallback(
    (id: string) => {
      if (!user?.companyIds.includes(id)) {
        return;
      }
      setCompany(db.companies.find((item) => item.id === id) ?? null);
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
    return db.companies.filter((item) => item.is_active && user.companyIds.includes(item.id));
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
      const result = await api<{ expense: Expense }>("/api/expenses", {
        method: "POST",
        body: JSON.stringify(input),
      });
      await refreshData();
      return result.expense;
    },
    [refreshData],
  );

  const applyFinanceAction = useCallback(
    async (expenseId: string, action: FinanceAction, payload?: FinanceActionPayload) => {
      await api("/api/expenses/action", {
        method: "POST",
        body: JSON.stringify({ expenseId, action, payload }),
      });
      await refreshData();
    },
    [refreshData],
  );

  const inviteUser = useCallback(
    async (email: string, role: Role, companyIds: string[]) => {
      const result = await api<{
        invitation: Invitation;
        emailSent: boolean;
        emailError?: string;
      }>("/api/invitations", {
        method: "POST",
        body: JSON.stringify({ email, role, companyIds }),
      });
      await refreshData();
      return { ...result.invitation, emailSent: result.emailSent, emailError: result.emailError };
    },
    [refreshData],
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
      setUser(result.user);
      syncSentryUser(result.user);
      setCompany(null);
      await refreshData(result.user);
      return result.user;
    },
    [refreshData],
  );

  const toggleUserStatus = useCallback(
    async (userId: string) => {
      await api("/api/users/toggle", {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      await refreshData();
    },
    [refreshData],
  );

  const updateUserAccess = useCallback(
    async (userId: string, role: Role, companyIds: string[]) => {
      const result = await api<{ user: User }>("/api/users", {
        method: "PATCH",
        body: JSON.stringify({ userId, role, companyIds }),
      });
      if (user?.id === userId) {
        setUser(result.user);
        syncSentryUser(result.user);
        setCompany((current) =>
          current && result.user.companyIds.includes(current.id) ? current : null,
        );
      }
      await refreshData(user?.id === userId ? result.user : undefined);
    },
    [refreshData, user],
  );

  const updateInvitationAccess = useCallback(
    async (invitationId: string, role: Role, companyIds: string[]) => {
      await api("/api/invitations", {
        method: "PATCH",
        body: JSON.stringify({ invitationId, role, companyIds }),
      });
      await refreshData();
    },
    [refreshData],
  );

  const createCompany = useCallback(
    async (input: { name: string; color: string }) => {
      await api("/api/companies", {
        method: "POST",
        body: JSON.stringify(input),
      });
      await refreshData();
    },
    [refreshData],
  );

  const createCategory = useCallback(
    async (input: { name: string; color: string }) => {
      await api("/api/categories", {
        method: "POST",
        body: JSON.stringify(input),
      });
      await refreshData();
    },
    [refreshData],
  );

  const updateCategory = useCallback(
    async (id: string, patch: Partial<Category>) => {
      await api("/api/categories", {
        method: "PATCH",
        body: JSON.stringify({ id, patch }),
      });
      await refreshData();
    },
    [refreshData],
  );

  const findUser = useCallback((id: string) => db.users.find((item) => item.id === id), [db.users]);
  const findCompany = useCallback(
    (id: string) => db.companies.find((item) => item.id === id),
    [db.companies],
  );

  const value = useMemo<StoreValue>(
    () => ({
      ready,
      needsSetup,
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
      updateUserAccess,
      updateInvitationAccess,
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
      needsSetup,
      ready,
      selectCompany,
      switchCompany,
      toggleUserStatus,
      updateCategory,
      updateInvitationAccess,
      updateUserAccess,
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
