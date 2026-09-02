"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell, canAccessScreen } from "@/components/app-shell";
import { AuditPage } from "@/components/audit-page";
import { CompanySelect } from "@/components/company-select";
import { Dashboard } from "@/components/dashboard";
import { ExpenseDrawer } from "@/components/expense-drawer";
import { ExpenseForm } from "@/components/expense-form";
import { TicketForm } from "@/components/ticket-form";
import { ExpenseList } from "@/components/expense-list";
import { FinancePage } from "@/components/finance-page";
import { InvitePage } from "@/components/invite-page";
import { LoginPage } from "@/components/login-page";
import { ReportsPage } from "@/components/reports-page";
import { SettingsPage } from "@/components/settings-page";
import { UsersPage } from "@/components/users-page";
import { KINDNESS_PHRASES } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Expense, RequestArea, Screen } from "@/lib/types";
import { assertNever } from "@/lib/types";
import { homeScreen } from "@/lib/workflow";

export function RomFlowApp({ inviteToken }: { inviteToken?: string }) {
  const store = useStore();
  const router = useRouter();
  const token = inviteToken ?? "";
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Expense | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [inviteMode, setInviteMode] = useState(Boolean(inviteToken));
  const [loginBanner, setLoginBanner] = useState("");

  const greeting = KINDNESS_PHRASES[new Date().getDate() % KINDNESS_PHRASES.length];
  const accessibleCompanies = store.accessibleCompanies();
  const onlyCompanyId = accessibleCompanies.length === 1 ? accessibleCompanies[0].id : null;
  const expenses = store.companyExpenses();
  const myExpenses = expenses.filter((item) => item.requester === store.user?.id);

  const selectCompany = store.selectCompany;
  const switchCompany = store.switchCompany;
  const currentCompanyId = store.company?.id ?? null;

  useEffect(() => {
    if (!store.user || currentCompanyId || !onlyCompanyId) {
      return;
    }
    selectCompany(onlyCompanyId);
  }, [currentCompanyId, onlyCompanyId, selectCompany, store.user]);

  useEffect(() => {
    if (!currentCompanyId) {
      return;
    }
    if (!accessibleCompanies.some((item) => item.id === currentCompanyId)) {
      switchCompany();
    }
  }, [accessibleCompanies, currentCompanyId, switchCompany]);

  const closePopovers = useCallback(() => {
    setNotificationsOpen(false);
    setProfileOpen(false);
    setMenuOpen(false);
  }, []);

  const navigate = useCallback(
    (next: Screen) => {
      if (store.user && !canAccessScreen(store.user, next)) {
        return;
      }
      setScreen(next);
      closePopovers();
    },
    [closePopovers, store.user],
  );

  if (!store.ready) {
    return (
      <div className="login-page">
        <section className="login-form-wrap">
          <div className="login-form">
            <span className="secure-label">ROM FLOW</span>
            <h2>Carregando o fluxo...</h2>
          </div>
        </section>
      </div>
    );
  }

  if (inviteMode) {
    return (
      <InvitePage
        token={token}
        onValidate={store.validateInvite}
        onAccept={async (invite, name, password) => {
          await store.acceptInvite(invite, name, password);
          setInviteMode(false);
          router.replace("/");
        }}
        onGoToLogin={() => {
          setInviteMode(false);
          router.replace("/");
        }}
      />
    );
  }

  if (!store.user) {
    return (
      <LoginPage
        banner={loginBanner}
        needsSetup={store.needsSetup}
        onBootstrap={async (name, email, password) => {
          await store.bootstrapAdmin(name, email, password);
          setScreen("dashboard");
        }}
        onLogin={async (email, password) => {
          const session = await store.login(email, password);
          setScreen(homeScreen(session.role));
        }}
      />
    );
  }

  if (!store.company) {
    if (onlyCompanyId) {
      return (
        <div className="login-page">
          <section className="login-form-wrap">
            <div className="login-form">
              <span className="secure-label">ROM FLOW</span>
              <h2>Abrindo sua empresa...</h2>
            </div>
          </section>
        </div>
      );
    }
    return (
      <CompanySelect
        user={store.user}
        companies={accessibleCompanies}
        expenses={store.db.expenses}
        onSelect={(id) => {
          store.selectCompany(id);
          setScreen(homeScreen(store.user?.role ?? "solicitante"));
        }}
        onLogout={store.logout}
      />
    );
  }

  const companyNames = Object.fromEntries(store.db.companies.map((item) => [item.id, item.name]));
  const visibleScreen = store.user && canAccessScreen(store.user, screen)
    ? screen
    : homeScreen(store.user.role);

  function renderScreen(current: Screen) {
    const role = store.user!.role;
    const resolved = canAccessScreen(store.user!, current)
      ? current
      : homeScreen(role);
    switch (resolved) {
      case "dashboard":
        return (
          <Dashboard
            role={store.user!.role}
            company={store.company!}
            user={store.user!}
            expenses={expenses}
            categories={store.db.categories}
            onNavigate={navigate}
            onOpenExpense={setSelected}
          />
        );
      case "expenses":
        return (
          <ExpenseList
            expenses={store.user!.role === "solicitante" ? myExpenses : expenses}
            search={search}
            title={store.user!.role === "solicitante" ? "Minhas solicitações" : "Todas as solicitações"}
            subtitle={
              store.user!.role === "solicitante"
                ? "Acompanhe cada etapa das suas solicitações."
                : "Visão completa das solicitações desta empresa."
            }
            eyebrow={store.user!.role === "solicitante" ? "MEU FLUXO" : "TODAS AS OPERAÇÕES"}
            companyNames={companyNames}
            user={store.user!}
            onSearch={setSearch}
            onNavigate={navigate}
            onOpen={setSelected}
          />
        );
      case "my-expenses":
        return (
          <ExpenseList
            expenses={myExpenses}
            search={search}
            companyNames={companyNames}
            user={store.user!}
            onSearch={setSearch}
            onNavigate={navigate}
            onOpen={setSelected}
          />
        );
      case "new-financeiro":
      case "new-manutencao":
      case "new-compras":
      case "new-rh": {
        const area: RequestArea =
          resolved === "new-financeiro"
            ? "financeiro"
            : resolved === "new-manutencao"
              ? "manutencao"
              : resolved === "new-compras"
                ? "compras"
                : "rh";
        const back = store.user!.role === "solicitante" ? "expenses" : "my-expenses";
        if (area === "financeiro") {
          return (
            <ExpenseForm
              company={store.company!}
              user={store.user!}
              categories={store.db.categories}
              greetingPhrase={greeting}
              onCancel={() => navigate(back)}
              onCreated={async (input) => {
                await store.createExpense(input);
                navigate(back);
              }}
            />
          );
        }
        return (
          <TicketForm
            area={area}
            company={store.company!}
            user={store.user!}
            onCancel={() => navigate(back)}
            onCreated={async (input) => {
              await store.createExpense(input);
              navigate(back);
            }}
          />
        );
      }
      case "approvals":
        return (
          <FinancePage
            mode="approvals"
            expenses={expenses}
            users={store.db.users}
            onOpen={setSelected}
          />
        );
      case "payments":
        return (
          <FinancePage
            mode="payments"
            expenses={expenses}
            users={store.db.users}
            onOpen={setSelected}
          />
        );
      case "reports":
        return <ReportsPage expenses={expenses} categories={store.db.categories} />;
      case "users":
        return (
          <UsersPage
            users={store.db.users}
            invitations={store.db.invitations}
            companies={store.db.companies}
            currentUserId={store.user!.id}
            onInvite={store.inviteUser}
            onUpdateUser={store.updateUserAccess}
            onUpdateInvitation={store.updateInvitationAccess}
            onToggle={async (userId) => {
              await store.toggleUserStatus(userId);
            }}
          />
        );
      case "audit":
        return <AuditPage logs={store.db.auditLogs} emailLogs={store.db.emailLogs} users={store.db.users} />;
      case "settings":
        return (
          <SettingsPage
            companies={store.db.companies}
            categories={store.db.categories}
            onCreateCompany={store.createCompany}
            onCreateCategory={store.createCategory}
            onToggleCategory={(id, is_active) => store.updateCategory(id, { is_active })}
          />
        );
      default:
        return assertNever(resolved);
    }
  }

  return (
    <>
      <AppShell
        role={store.user.role}
        company={store.company}
        user={store.user}
        expenses={store.user.role === "solicitante" ? myExpenses : expenses}
        screen={visibleScreen}
        search={search}
        onSearch={setSearch}
        onNavigate={navigate}
        onSwitchCompany={() => {
          closePopovers();
          store.switchCompany();
        }}
        onBack={() => {
          closePopovers();
          const home = homeScreen(store.user!.role);
          if (visibleScreen !== home) {
            navigate(home);
            return;
          }
          store.switchCompany();
        }}
        onReload={() => {
          void store.reload();
        }}
        onLogout={async () => {
          await store.logout();
          setLoginBanner("");
        }}
        notificationsOpen={notificationsOpen}
        profileOpen={profileOpen}
        menuOpen={menuOpen}
        onToggleNotifications={() => {
          setProfileOpen(false);
          setNotificationsOpen((value) => !value);
        }}
        onToggleProfile={() => {
          setNotificationsOpen(false);
          setProfileOpen((value) => !value);
        }}
        onToggleMenu={() => setMenuOpen((value) => !value)}
      >
        {renderScreen(visibleScreen)}
      </AppShell>
      {selected &&
      (store.user.role !== "solicitante" || selected.requester === store.user.id) ? (
        <ExpenseDrawer
          expense={store.db.expenses.find((item) => item.id === selected.id) ?? selected}
          requester={store.findUser(selected.requester)}
          companyName={store.findCompany(selected.company)?.name ?? store.company.name}
          user={store.user}
          onClose={() => setSelected(null)}
          onAction={async (action, payload) => {
            await store.applyFinanceAction(selected.id, action, payload);
          }}
        />
      ) : null}
    </>
  );
}
