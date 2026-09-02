"use client";

import { ArrowUpRight, CheckCircle2, ClipboardCheck, LayoutDashboard, Plus, Sparkles, Wallet } from "lucide-react";
import { useState } from "react";
import { CATEGORY_COLOR, KINDNESS_PHRASES, money, parseDate } from "@/lib/format";
import type { Category, Company, Expense, Role, Screen, User } from "@/lib/types";
import { StatusBadge } from "./status-badge";

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function lastSixMonthBuckets(now: number): { label: string; start: number; end: number }[] {
  const date = new Date(now);
  const buckets: { label: string; start: number; end: number }[] = [];
  for (let offset = 5; offset >= 0; offset -= 1) {
    const startDate = new Date(date.getFullYear(), date.getMonth() - offset, 1);
    const endDate = new Date(date.getFullYear(), date.getMonth() - offset + 1, 1);
    buckets.push({
      label: MONTH_LABELS[startDate.getMonth()],
      start: startDate.getTime(),
      end: endDate.getTime(),
    });
  }
  return buckets;
}

function chartLine(values: number[], max: number): string {
  return values
    .map((value, index) => {
      const x = values.length === 1 ? 0 : (index / (values.length - 1)) * 500;
      const y = max === 0 ? 160 : 160 - (value / max) * 132;
      return `${index === 0 ? "M" : "L"}${x} ${y}`;
    })
    .join(" ");
}

export function Dashboard({
  role,
  company,
  user,
  expenses,
  categories,
  onNavigate,
  onOpenExpense,
}: {
  role: Role;
  company: Company;
  user: User;
  expenses: Expense[];
  categories: Category[];
  onNavigate: (screen: Screen) => void;
  onOpenExpense: (expense: Expense) => void;
}) {
  const [now] = useState(() => Date.now());
  const isEmpty = expenses.length === 0;
  const paid = expenses.filter((item) => item.status === "paga");
  const pending = expenses.filter((item) => !["paga", "recusada"].includes(item.status));
  const urgent = pending.filter(
    (item) => parseDate(item.max_payment_date).getTime() - now < 3 * 86_400_000,
  );
  const total = expenses.reduce((sum, item) => sum + item.amount, 0);
  const paidTotal = paid.reduce((sum, item) => sum + item.amount, 0);
  const pendingTotal = pending.reduce((sum, item) => sum + item.amount, 0);
  const today = new Date(now).toDateString();
  const dueToday = pending
    .filter((item) => parseDate(item.max_payment_date).toDateString() === today)
    .reduce((sum, item) => sum + item.amount, 0);
  const lastReimburse = expenses.find((item) => item.expense_type === "reembolso");
  const greeting = KINDNESS_PHRASES[new Date(now).getDate() % KINDNESS_PHRASES.length];
  const categoryStats = (categories.length
    ? categories.map((item) => ({ category: item.name, color: item.color }))
    : Object.entries(CATEGORY_COLOR).map(([category, color]) => ({ category, color }))
  ).map((item) => ({
    ...item,
    value: expenses.filter((expense) => expense.category === item.category).reduce((sum, expense) => sum + expense.amount, 0),
  }));
  const maxCategory = Math.max(...categoryStats.map((item) => item.value), 1);

  const kpis =
    role === "financeiro"
      ? [
          {
            label: "Aguardando aprovação",
            value: money(pendingTotal),
            foot: `${pending.length} solicitações`,
            icon: ClipboardCheck,
            trend: "Precisam de atenção",
            tone: "violet",
          },
          {
            label: "Para pagar hoje",
            value: money(dueToday),
            foot: `${urgent.length} urgentes`,
            icon: Wallet,
            trend: "Prazo crítico",
            tone: "amber",
          },
          {
            label: "Volume mensal",
            value: money(total),
            foot: `${expenses.length} solicitações`,
            icon: LayoutDashboard,
            trend: "No período",
            tone: "emerald",
          },
        ]
      : role === "admin"
        ? [
            {
              label: "Volume monitorado",
              value: money(total),
              foot: `${expenses.length} registros`,
              icon: LayoutDashboard,
              trend: isEmpty ? "Sem movimentações" : "Todas as operações",
              tone: "violet",
            },
            {
              label: "Fluxos pendentes",
              value: String(pending.length),
              foot: money(pendingTotal),
              icon: ClipboardCheck,
              trend: `${urgent.length} urgentes`,
              tone: "amber",
            },
            {
              label: "Pagamentos concluídos",
              value: money(paidTotal),
              foot: `${paid.length} pagamentos`,
              icon: CheckCircle2,
              trend: isEmpty ? "Aguardando pagamentos" : "Governança ativa",
              tone: "emerald",
            },
          ]
        : [
            {
              label: "Total gasto no mês",
              value: money(paidTotal),
              foot: `${paid.length} pagamentos`,
              icon: Wallet,
              trend: "No período",
              tone: "emerald",
            },
            {
              label: "Solicitações pendentes",
              value: String(pending.length),
              foot: `${urgent.length} com prazo próximo`,
              icon: ClipboardCheck,
              trend: "Precisam de atenção",
              tone: "amber",
            },
            {
              label: "Último reembolso",
              value: lastReimburse ? money(lastReimburse.amount) : "Aguardando histórico",
              foot: lastReimburse ? lastReimburse.title : "Nenhum reembolso pago",
              icon: ArrowUpRight,
              trend: lastReimburse ? "Registrado" : "Aguardando histórico",
              tone: "violet",
            },
          ];

  const monthBuckets = lastSixMonthBuckets(now);
  const monthValues = monthBuckets.map((bucket) =>
    expenses
      .filter((item) => {
        const created = new Date(item.created).getTime();
        return created >= bucket.start && created < bucket.end;
      })
      .reduce((sum, item) => sum + item.amount, 0),
  );
  const maxMonth = Math.max(...monthValues, 0);
  const previousMonth = monthValues[monthValues.length - 2] ?? 0;
  const currentMonth = monthValues[monthValues.length - 1] ?? 0;
  const monthTrend =
    isEmpty || previousMonth <= 0
      ? "—"
      : `${currentMonth >= previousMonth ? "+" : ""}${(((currentMonth - previousMonth) / previousMonth) * 100).toFixed(1).replace(".", ",")}%`;
  const linePath = chartLine(monthValues, maxMonth);

  return (
    <div className="page-stack">
      <section className="kindness-banner fade-in">
        <div className="kindness-content">
          <span className="kindness-icon-pulse">
            <Sparkles size={16} />
          </span>
          <div className="kindness-text">
            <strong>{greeting}</strong>
            <span>
              {user.name ? `Olá, ${user.name.split(" ")[0]}! ` : ""}
              Estamos aqui para agilizar seu pedido de pagamento.
            </span>
          </div>
        </div>
        <div className="kindness-tag">
          <Sparkles size={13} /> ROM Flow Care
        </div>
      </section>
      <section className="welcome-row">
        <div>
          <span className="eyebrow">
            <Sparkles size={14} /> VISÃO CONSOLIDADA
          </span>
          <h2>
            O fluxo financeiro da <span>{company.name}</span>
          </h2>
          <p>Acompanhe tudo o que exige sua atenção e mantenha os pagamentos em dia.</p>
        </div>
        {role === "solicitante" ? (
          <button className="primary-button" onClick={() => onNavigate("new-expense")}>
            <Plus size={18} /> Nova despesa
          </button>
        ) : null}
        {role === "financeiro" ? (
          <button className="primary-button" onClick={() => onNavigate("approvals")}>
            <ClipboardCheck size={18} /> Ver fila de aprovação
          </button>
        ) : null}
        {role === "admin" ? (
          <div className="dashboard-header-actions">
            <button className="secondary-button" onClick={() => onNavigate("approvals")}>
              <ClipboardCheck size={17} /> Fila de aprovação
            </button>
            <button className="primary-button" onClick={() => onNavigate("new-expense")}>
              <Plus size={18} /> Nova despesa
            </button>
          </div>
        ) : null}
      </section>
      <section className="kpi-grid">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <article className={`kpi-card kpi-${kpi.tone}`} key={kpi.label}>
              <div className="kpi-head">
                <span>{kpi.label}</span>
                <i>
                  <Icon size={19} />
                </i>
              </div>
              <strong>{kpi.value}</strong>
              <div className="kpi-foot">
                <span>{kpi.foot}</span>
                <em>
                  <ArrowUpRight size={13} /> {kpi.trend}
                </em>
              </div>
            </article>
          );
        })}
      </section>
      <section className="dashboard-grid">
        <article className="panel chart-panel">
          <header className="panel-header">
            <div>
              <h3>Despesas por categoria</h3>
              <p>Distribuição do volume no período</p>
            </div>
            <button type="button">Este mês</button>
          </header>
          {isEmpty ? (
            <div className="empty-state">
              <strong>Nenhuma despesa neste negócio.</strong>
              <span>As categorias aparecem quando houver solicitações.</span>
            </div>
          ) : (
            <div className="bar-chart">
              {categoryStats.map((item) => (
                <div key={item.category}>
                  <span className="bar-value">{item.value ? money(item.value) : "—"}</span>
                  <span className="bar-track">
                    <i
                      style={{
                        height: `${item.value === 0 ? 0 : Math.max((item.value / maxCategory) * 100, 4)}%`,
                        background: item.color,
                      }}
                    />
                  </span>
                  <strong>{item.category}</strong>
                </div>
              ))}
            </div>
          )}
        </article>
        <article className="panel trend-panel">
          <header className="panel-header">
            <div>
              <h3>Tendência de gastos</h3>
              <p>Últimos 6 meses</p>
            </div>
            <span className={previousMonth > 0 && currentMonth >= previousMonth ? "positive-trend" : undefined}>
              {monthTrend}
            </span>
          </header>
          {isEmpty ? (
            <div className="empty-state">
              <strong>Sem tendência ainda.</strong>
              <span>O gráfico dos últimos 6 meses aparece com as primeiras despesas.</span>
            </div>
          ) : (
            <div className="line-chart">
              <div className="line-grid" />
              <svg viewBox="0 0 500 180" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity=".28" />
                    <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={`${linePath} L500 180 L0 180 Z`} fill="url(#area)" />
                <path d={linePath} fill="none" stroke="#10B981" strokeWidth="4" />
              </svg>
              <div className="chart-labels">
                {monthBuckets.map((item) => (
                  <span key={item.start}>{item.label}</span>
                ))}
              </div>
            </div>
          )}
        </article>
        <article className="panel activity-panel">
          <header className="panel-header">
            <div>
              <h3>Atividade recente</h3>
              <p>Atualizações do seu fluxo</p>
            </div>
          </header>
          {expenses.length === 0 ? (
            <div className="empty-state">
              <strong>Seu fluxo ainda não possui movimentações.</strong>
              <span>Crie a primeira solicitação para começar.</span>
            </div>
          ) : (
            <div className="activity-list">
              {expenses.slice(0, 6).map((item) => (
                <button key={item.id} type="button" onClick={() => onOpenExpense(item)}>
                  <span className="activity-avatar">
                    {item.title.slice(0, 2).toUpperCase()}
                  </span>
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.category}</small>
                  </span>
                  <em>{money(item.amount)}</em>
                  <StatusBadge status={item.status} />
                </button>
              ))}
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
