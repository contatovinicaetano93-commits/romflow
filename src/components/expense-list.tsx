"use client";

import { Filter, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { AREA_LABEL, money, shortId } from "@/lib/format";
import type { Expense, ExpenseStatus, FinanceAction, RequestArea, Screen, User } from "@/lib/types";
import { allowedActions, newRequestScreen } from "@/lib/workflow";
import { MaintenanceStepper } from "./maintenance-stepper";
import { StatusBadge } from "./status-badge";

const STATUS_FILTERS: Array<{ value: "todos" | ExpenseStatus; label: string }> = [
  { value: "todos", label: "Todos os status" },
  { value: "em_analise", label: "Em análise" },
  { value: "devolvido", label: "Devolvido" },
  { value: "aprovada", label: "Aprovado" },
  { value: "recusada", label: "Recusado" },
  { value: "aberta", label: "Aberta" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "finalizada", label: "Finalizada" },
  { value: "cancelada", label: "Cancelada" },
];

export function ExpenseList({
  expenses,
  search,
  title = "Minhas solicitações",
  subtitle = "Acompanhe cada etapa das suas solicitações.",
  eyebrow = "MEU FLUXO",
  companyNames = {},
  user,
  onSearch,
  onNavigate,
  onOpen,
  onAction,
}: {
  expenses: Expense[];
  search: string;
  title?: string;
  subtitle?: string;
  eyebrow?: string;
  companyNames?: Record<string, string>;
  user: User;
  onSearch: (value: string) => void;
  onNavigate: (screen: Screen) => void;
  onOpen: (expense: Expense) => void;
  onAction?: (expense: Expense, action: FinanceAction) => void | Promise<void>;
}) {
  const [status, setStatus] = useState<"todos" | ExpenseStatus>("todos");
  const [areaFilter, setAreaFilter] = useState<"todas" | RequestArea>("todas");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      expenses.filter((item) => {
        const matchesSearch = `${item.title} ${item.beneficiary_name} ${item.category} ${AREA_LABEL[item.area]}`
          .toLowerCase()
          .includes(search.toLowerCase());
        const matchesStatus = status === "todos" || item.status === status;
        const matchesArea = areaFilter === "todas" || item.area === areaFilter;
        return matchesSearch && matchesStatus && matchesArea;
      }),
    [areaFilter, expenses, search, status],
  );

  const total = filtered.reduce((sum, item) => sum + item.amount, 0);
  const hasMaintenance = expenses.some((item) => item.area === "manutencao");

  async function run(item: Expense, action: FinanceAction) {
    if (!onAction) {
      onOpen(item);
      return;
    }
    setBusyId(item.id);
    try {
      await onAction(item, action);
      setConfirmCancel(null);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page-stack">
      <section className="page-title-row">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <button className="primary-button" onClick={() => onNavigate(newRequestScreen(user))}>
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
            <strong>{hasMaintenance ? "Manutenção: ande o status aqui" : "Abra o detalhe para decidir"}</strong>
            <small>
              {hasMaintenance
                ? "Em andamento, finalizada ou cancelar no próprio chamado"
                : "Aprove, devolva ou recuse pelo detalhe"}
            </small>
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
              placeholder="Buscar solicitação"
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
            <select
              value={areaFilter}
              onChange={(event) => setAreaFilter(event.target.value as typeof areaFilter)}
            >
              <option value="todas">Todas as áreas</option>
              <option value="financeiro">Financeiro</option>
              <option value="manutencao">Manutenção</option>
              <option value="compras">Compras</option>
              <option value="rh">RH</option>
            </select>
          </label>
        </div>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <strong>
              {expenses.length === 0
                ? "Nenhuma solicitação neste negócio."
                : "Nenhuma solicitação encontrada"}
            </strong>
            <span>
              {expenses.length === 0
                ? "Crie a primeira solicitação para começar o fluxo."
                : "Ajuste os filtros ou abra uma nova solicitação."}
            </span>
          </div>
        ) : (
          <div className="expense-table-wrap">
            <table className="expense-table">
              <thead>
                <tr>
                  <th>Solicitação</th>
                  <th>Área</th>
                  <th>Valor</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const actions = allowedActions(user, item);
                  const canWalk =
                    item.area === "manutencao" &&
                    (actions.includes("progress") ||
                      actions.includes("complete") ||
                      actions.includes("cancel"));
                  return (
                    <tr key={item.id}>
                      <td>
                        <button className="expense-main" type="button" onClick={() => onOpen(item)}>
                          <span className="category-icon">{AREA_LABEL[item.area].slice(0, 1)}</span>
                          <span>
                            <strong>{item.title}</strong>
                            <small>
                              #{shortId(item.id)}
                              {companyNames[item.company] ? ` • ${companyNames[item.company]}` : ""}
                              {item.area === "financeiro" ? ` • ${item.beneficiary_name}` : ""}
                            </small>
                          </span>
                        </button>
                      </td>
                      <td>
                        <span className="table-subline">{AREA_LABEL[item.area]}</span>
                      </td>
                      <td className="amount-cell">{item.amount > 0 ? money(item.amount) : "—"}</td>
                      <td>
                        {canWalk ? (
                          <div className="list-status-actions">
                            <StatusBadge status={item.status} />
                            {confirmCancel === item.id ? (
                              <div className="list-cancel-confirm">
                                <button
                                  type="button"
                                  className="primary-button destructive-button"
                                  disabled={busyId === item.id}
                                  onClick={() => void run(item, "cancel")}
                                >
                                  Confirmar cancelamento
                                </button>
                                <button
                                  type="button"
                                  className="secondary-button"
                                  onClick={() => setConfirmCancel(null)}
                                >
                                  Voltar
                                </button>
                              </div>
                            ) : (
                              <MaintenanceStepper
                                expense={item}
                                actions={actions}
                                busy={busyId === item.id}
                                onAction={(action) => {
                                  if (action === "cancel") {
                                    setConfirmCancel(item.id);
                                    return;
                                  }
                                  void run(item, action);
                                }}
                              />
                            )}
                          </div>
                        ) : (
                          <button type="button" className="status-open" onClick={() => onOpen(item)}>
                            <StatusBadge status={item.status} />
                          </button>
                        )}
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
