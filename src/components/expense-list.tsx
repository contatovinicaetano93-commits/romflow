"use client";

import { Filter, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { daysUntil, formatDate, money, shortId } from "@/lib/format";
import type { Expense, ExpenseStatus, Screen } from "@/lib/types";
import { StatusBadge } from "./status-badge";

const STATUS_FILTERS: Array<{ value: "todos" | ExpenseStatus; label: string }> = [
  { value: "todos", label: "Todos os status" },
  { value: "enviada", label: "Enviada" },
  { value: "em_analise", label: "Em análise" },
  { value: "aguardando_documentacao", label: "Devolvido" },
  { value: "agendada", label: "Agendado" },
  { value: "aprovada", label: "Aprovado" },
  { value: "paga", label: "Pago" },
  { value: "recusada", label: "Recusada" },
];

export function ExpenseList({
  expenses,
  search,
  title = "Minhas solicitações",
  subtitle = "Acompanhe prazos, documentos e cada etapa até o pagamento.",
  eyebrow = "MEU FLUXO",
  companyNames = {},
  onSearch,
  onNavigate,
  onOpen,
}: {
  expenses: Expense[];
  search: string;
  title?: string;
  subtitle?: string;
  eyebrow?: string;
  companyNames?: Record<string, string>;
  onSearch: (value: string) => void;
  onNavigate: (screen: Screen) => void;
  onOpen: (expense: Expense) => void;
}) {
  const [status, setStatus] = useState<"todos" | ExpenseStatus>("todos");
  const [category, setCategory] = useState("todas");

  const filtered = useMemo(
    () =>
      expenses.filter((item) => {
        const matchesSearch = `${item.title} ${item.beneficiary_name} ${item.category}`
          .toLowerCase()
          .includes(search.toLowerCase());
        const matchesStatus = status === "todos" || item.status === status;
        const matchesCategory = category === "todas" || item.category === category;
        return matchesSearch && matchesStatus && matchesCategory;
      }),
    [category, expenses, search, status],
  );

  const total = filtered.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="page-stack">
      <section className="page-title-row">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <button className="primary-button" onClick={() => onNavigate("new-expense")}>
          <Plus size={18} /> Nova Solicitação
        </button>
      </section>
      <section className="list-summary">
        <div>
          <span>{filtered.length}</span>
          <p>
            <strong>solicitações</strong>
            <small>nos filtros atuais</small>
          </p>
        </div>
        <div>
          <span>{money(total)}</span>
          <p>
            <strong>volume total</strong>
            <small>valor solicitado</small>
          </p>
        </div>
        <div className="summary-status">
          <i />
          <p>
            <strong>Atualização em tempo real</strong>
            <small>Você será avisado sobre mudanças</small>
          </p>
        </div>
      </section>
      <section className="panel data-panel">
        <div className="filter-bar">
          <div className="table-search">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Buscar solicitação, beneficiário ou categoria"
            />
          </div>
          <label>
            <Filter size={14} />
            <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
              {STATUS_FILTERS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="todas">Todas as categorias</option>
              <option>Viagem</option>
              <option>Alimentação</option>
              <option>Escritório</option>
              <option>Software</option>
              <option>Outros</option>
            </select>
          </label>
        </div>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <strong>Nenhuma solicitação encontrada</strong>
            <span>Ajuste os filtros ou faça um novo pedido de pagamento.</span>
          </div>
        ) : (
          <div className="expense-table-wrap">
            <table className="expense-table">
              <thead>
                <tr>
                  <th>Solicitação</th>
                  <th>Empresa</th>
                  <th>Data limite</th>
                  <th>Valor</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const days = daysUntil(item.max_payment_date);
                  return (
                    <tr key={item.id}>
                      <td>
                        <button className="expense-main" type="button" onClick={() => onOpen(item)}>
                          <span className="category-icon">{item.category.slice(0, 1)}</span>
                          <span>
                            <strong>{item.title}</strong>
                            <small>
                              #{shortId(item.id)} • {item.beneficiary_name}
                            </small>
                          </span>
                        </button>
                      </td>
                      <td>
                        <span className="table-subline">{companyNames[item.company] || "—"}</span>
                      </td>
                      <td>
                        {formatDate(item.max_payment_date)}
                        <small className="table-subline">
                          {days < 0 ? "Prazo encerrado" : `${days} dias`}
                        </small>
                      </td>
                      <td className="amount-cell">{money(item.amount)}</td>
                      <td>
                        <StatusBadge status={item.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
