"use client";

import { BarChart3, CheckCircle2, PieChart, Search, Wallet } from "lucide-react";
import { STATUS_COLOR, STATUS_LABEL, matchesExpenseSearch, money } from "@/lib/format";
import type { Category, Expense, ExpenseStatus } from "@/lib/types";

const STATUS_ORDER: ExpenseStatus[] = [
  "em_analise",
  "devolvido",
  "aprovada",
  "recusada",
  "aberta",
  "em_andamento",
  "finalizada",
  "cancelada",
];

function donutGradient(slices: Array<{ color: string; pct: number }>): string {
  if (slices.length === 0) {
    return "conic-gradient(#27272a 0 100%)";
  }
  let cursor = 0;
  const stops: string[] = [];
  slices.forEach((slice, index) => {
    const start = cursor;
    const end = index === slices.length - 1 ? 100 : Math.min(100, cursor + slice.pct);
    stops.push(`${slice.color} ${start}% ${end}%`);
    cursor = end;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

export function ReportsPage({
  expenses,
  categories: categoryOptions,
  search = "",
  onSearch,
}: {
  expenses: Expense[];
  categories: Category[];
  search?: string;
  onSearch?: (value: string) => void;
}) {
  const visible = expenses.filter((item) => matchesExpenseSearch(item, search));
  const total = visible.reduce((sum, item) => sum + item.amount, 0);
  const paid = visible.filter((item) => Boolean(item.payment_proof));
  const paidTotal = paid.reduce((sum, item) => sum + item.amount, 0);
  const ticket = visible.length ? total / visible.length : 0;
  const categories = categoryOptions
    .map((item) => {
      const value = visible
        .filter((expense) => expense.category === item.name)
        .reduce((sum, expense) => sum + expense.amount, 0);
      return { name: item.name, color: item.color, value, pct: total ? Math.round((value / total) * 100) : 0 };
    })
    .filter((item) => item.value > 0);
  const byStatus = STATUS_ORDER.map((status) => ({
    status,
    count: visible.filter((item) => item.status === status).length,
  }));
  const slices = byStatus
    .filter((item) => item.count > 0)
    .map((item) => ({
      status: item.status,
      color: STATUS_COLOR[item.status],
      pct: visible.length ? (item.count / visible.length) * 100 : 0,
      count: item.count,
    }));
  const isEmpty = visible.length === 0;

  return (
    <div className="page-stack">
      <section className="page-title-row">
        <div>
          <span className="eyebrow">INTELIGÊNCIA FINANCEIRA</span>
          <h2>Relatórios financeiros</h2>
          <p>Analise o volume, a execução e a distribuição das despesas.</p>
        </div>
      </section>
      {onSearch ? (
        <div className="table-search mobile-only-search">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Filtrar relatórios por solicitação"
          />
        </div>
      ) : null}
      <section className="report-kpis">
        <article>
          <Wallet size={18} />
          <span>
            <small>Volume solicitado</small>
            <strong>{money(total)}</strong>
          </span>
        </article>
        <article>
          <CheckCircle2 size={18} />
          <span>
            <small>Total realizado</small>
            <strong>{money(paidTotal)}</strong>
          </span>
        </article>
        <article>
          <BarChart3 size={18} />
          <span>
            <small>Ticket médio</small>
            <strong>{money(ticket)}</strong>
          </span>
        </article>
        <article>
          <PieChart size={18} />
          <span>
            <small>Solicitações</small>
            <strong>{visible.length}</strong>
          </span>
        </article>
      </section>
      <section className="reports-grid">
        <article className="panel">
          <header className="panel-header">
            <div>
              <h3>Distribuição por categoria</h3>
              <p>Participação no valor total</p>
            </div>
          </header>
          {isEmpty ? (
            <div className="empty-state">
              <strong>{search.trim() ? "Nenhum resultado para a busca." : "Nenhuma despesa para distribuir."}</strong>
              <span>
                {search.trim()
                  ? "Ajuste o termo para ver a distribuição."
                  : "Este relatório fica vazio até existir a primeira solicitação."}
              </span>
            </div>
          ) : (
            <div className="report-category">
              {categories.map((item) => (
                <div key={item.name}>
                  <strong>{item.name}</strong>
                  <div className="report-progress">
                    <i style={{ width: `${item.pct}%`, background: item.color }} />
                  </div>
                  <strong>{money(item.value)}</strong>
                </div>
              ))}
            </div>
          )}
        </article>
        <article className="panel report-status">
          <header className="panel-header">
            <div>
              <h3>Saúde do fluxo</h3>
              <p>Solicitações por etapa</p>
            </div>
          </header>
          {isEmpty ? (
            <div className="empty-state">
              <strong>{search.trim() ? "Nenhum resultado para a busca." : "Fluxo ainda sem solicitações."}</strong>
              <span>
                {search.trim()
                  ? "Ajuste o termo para ver as etapas."
                  : "As etapas aparecem conforme o negócio começar a operar."}
              </span>
            </div>
          ) : (
            <>
              <div className="donut" style={{ background: donutGradient(slices) }}>
                <span>
                  <strong>{visible.length}</strong>
                  <small>Total</small>
                </span>
              </div>
              <div className="donut-legend">
                {slices.map((item) => (
                  <span key={item.status}>
                    <i style={{ background: item.color }} /> {STATUS_LABEL[item.status]}
                  </span>
                ))}
              </div>
              {byStatus.map((item) => (
                <div
                  key={item.status}
                  style={{
                    padding: "8px 20px",
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 11,
                    color: "#a1a1aa",
                  }}
                >
                  <span>{STATUS_LABEL[item.status]}</span>
                  <strong style={{ color: "#fff" }}>{item.count}</strong>
                </div>
              ))}
            </>
          )}
        </article>
      </section>
    </div>
  );
}
