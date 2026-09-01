"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  ChevronDown,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  Shield,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { ROLE_LABEL, cls, initials } from "@/lib/format";
import type { Company, Expense, Role, Screen, User } from "@/lib/types";
import { assertNever } from "@/lib/types";

type NavItem = {
  label: string;
  icon: LucideIcon;
  screen: Screen;
  primary?: boolean;
};

const NAV: Record<Role, NavItem[]> = {
  solicitante: [
    { label: "Nova Solicitação", icon: Plus, screen: "new-expense", primary: true },
    { label: "Minhas Solicitações", icon: FileText, screen: "expenses" },
  ],
  financeiro: [
    { label: "Visão geral", icon: LayoutDashboard, screen: "dashboard" },
    { label: "Central de aprovação", icon: ClipboardCheck, screen: "approvals" },
    { label: "Pagamentos", icon: Wallet, screen: "payments" },
    { label: "Nova Solicitação", icon: Plus, screen: "new-expense" },
    { label: "Minhas Solicitações", icon: FileText, screen: "my-expenses" },
    { label: "Todas Solicitações", icon: FileText, screen: "expenses" },
    { label: "Relatórios", icon: BarChart3, screen: "reports" },
  ],
  admin: [
    { label: "Visão geral", icon: LayoutDashboard, screen: "dashboard" },
    { label: "Nova Solicitação", icon: Plus, screen: "new-expense", primary: true },
    { label: "Minhas Solicitações", icon: FileText, screen: "my-expenses" },
    { label: "Central de aprovação", icon: ClipboardCheck, screen: "approvals" },
    { label: "Pagamentos", icon: Wallet, screen: "payments" },
    { label: "Todas Solicitações", icon: FileText, screen: "expenses" },
    { label: "Relatórios", icon: BarChart3, screen: "reports" },
    { label: "Gestão de usuários", icon: Users, screen: "users" },
    { label: "Log de auditoria", icon: Shield, screen: "audit" },
    { label: "Configurações", icon: Settings, screen: "settings" },
  ],
};

const TITLES: Record<Screen, string> = {
  dashboard: "Visão geral",
  expenses: "Todas as solicitações",
  "my-expenses": "Minhas solicitações",
  "new-expense": "Pedido de Pagamento",
  approvals: "Central de aprovação",
  payments: "Pagamentos",
  reports: "Relatórios financeiros",
  users: "Gestão de usuários",
  audit: "Log de auditoria",
  settings: "Configurações",
};

const BOTTOM: Screen[] = ["dashboard", "expenses", "new-expense", "approvals"];

export function AppShell({
  role,
  company,
  user,
  expenses,
  screen,
  search,
  onSearch,
  onNavigate,
  onSwitchCompany,
  onLogout,
  notificationsOpen,
  profileOpen,
  menuOpen,
  onToggleNotifications,
  onToggleProfile,
  onToggleMenu,
  children,
}: {
  role: Role;
  company: Company;
  user: User;
  expenses: Expense[];
  screen: Screen;
  search: string;
  onSearch: (value: string) => void;
  onNavigate: (screen: Screen) => void;
  onSwitchCompany: () => void;
  onLogout: () => void;
  notificationsOpen: boolean;
  profileOpen: boolean;
  menuOpen: boolean;
  onToggleNotifications: () => void;
  onToggleProfile: () => void;
  onToggleMenu: () => void;
  children: ReactNode;
}) {
  const items = NAV[role];
  const recent = expenses.slice(0, 4);
  const pendingCount = expenses.filter((item) =>
    ["enviada", "em_analise", "aguardando_documentacao"].includes(item.status),
  ).length;

  function titleFor(current: Screen): string {
    switch (current) {
      case "dashboard":
      case "expenses":
      case "my-expenses":
      case "new-expense":
      case "approvals":
      case "payments":
      case "reports":
      case "users":
      case "audit":
      case "settings":
        return TITLES[current];
      default:
        return assertNever(current);
    }
  }

  return (
    <div className="app-shell">
      {menuOpen ? (
        <button className="mobile-overlay" aria-label="Fechar menu" onClick={onToggleMenu} />
      ) : null}
      <aside className={cls("sidebar", menuOpen && "sidebar-open")}>
        <div className="brand-row">
          <div className="brand-mark">R</div>
          <div>
            <strong>ROM FLOW</strong>
            <span>Gestão financeira</span>
          </div>
          <button className="icon-button sidebar-close" onClick={onToggleMenu} aria-label="Fechar menu">
            <X size={18} />
          </button>
        </div>
        <button className="company-chip" onClick={onSwitchCompany}>
          <span className="company-mini" style={{ background: company.color }}>
            {company.initials}
          </span>
          <span>
            <small>Empresa ativa</small>
            <strong>{company.name}</strong>
          </span>
          <ChevronDown size={15} />
        </button>
        <nav className="side-nav" aria-label="Navegação principal">
          <small>AÇÕES</small>
          {items.map((item) => {
            const Icon = item.icon;
            const active = screen === item.screen;
            return (
              <button
                key={item.screen + item.label}
                className={cls("nav-item", active && "active", item.primary && "nav-item-highlight")}
                onClick={() => onNavigate(item.screen)}
              >
                <Icon size={16} />
                {item.label}
                {item.screen === "approvals" && pendingCount > 0 ? <em>{pendingCount}</em> : null}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-security">
          <Shield size={16} />
          <div>
            <strong>Ambiente protegido</strong>
            <span>Governança e auditoria ativas</span>
          </div>
        </div>
        <div className="sidebar-user">
          <div className="avatar-fallback">{initials(user.name)}</div>
          <div>
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
        </div>
      </aside>
      <div className="main-area">
        <header className="top-header">
          <div className="header-title">
            <button className="icon-button mobile-menu" onClick={onToggleMenu} aria-label="Abrir menu">
              <Menu size={18} />
            </button>
            <div>
              <span>ROM Flow</span>
              <h1>{titleFor(screen)}</h1>
            </div>
          </div>
          <div className="global-search">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Buscar solicitações, beneficiários, categorias"
            />
            <kbd>⌘ K</kbd>
          </div>
          <div className="header-actions">
            <div className="popover-wrap">
              <button
                className="icon-button notification-button"
                onClick={onToggleNotifications}
                aria-label="Notificações"
              >
                <Bell size={16} />
                {recent.length > 0 ? <i /> : null}
              </button>
              {notificationsOpen ? (
                <div className="header-popover notification-popover">
                  <div className="popover-title">
                    <strong>Notificações</strong>
                    <span>Status atualizado recentemente</span>
                  </div>
                  {recent.length === 0 ? (
                    <p>Nenhuma notificação no momento.</p>
                  ) : (
                    recent.map((item) => (
                      <button key={item.id} type="button" onClick={() => onNavigate("expenses")}>
                        <span className="activity-dot" />
                        <span>
                          <strong>{item.title}</strong>
                          <small>{item.status}</small>
                        </span>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>
            <div className="popover-wrap">
              <button className="profile-button" onClick={onToggleProfile}>
                <div className="avatar-fallback">{initials(user.name)}</div>
                <span className="profile-copy">
                  <strong>{user.name}</strong>
                  <small>{ROLE_LABEL[role]}</small>
                </span>
                <ChevronDown size={14} />
              </button>
              {profileOpen ? (
                <div className="header-popover profile-popover">
                  <button type="button" onClick={onSwitchCompany}>
                    Trocar empresa
                  </button>
                  <button type="button" onClick={onLogout}>
                    <LogOut size={14} /> Sair
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <div className="content-area">{children}</div>
        <nav className="bottom-nav">
          {BOTTOM.map((item) => {
            const def = NAV.admin.find((entry) => entry.screen === item) ?? NAV.solicitante[0];
            const Icon = def.icon;
            return (
              <button
                key={item}
                className={cls(screen === item && "active")}
                onClick={() => onNavigate(item)}
              >
                <Icon size={16} />
                {TITLES[item]}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
