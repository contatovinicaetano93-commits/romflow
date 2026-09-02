"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Search,
  Wallet,
} from "lucide-react";
import { daysUntil, money, shortId } from "@/lib/format";
import type { Expense, User } from "@/lib/types";
import { StatusBadge } from "./status-badge";

export function FinancePage({
  mode,
  expenses,
  users,
  onOpen,
}: {
  mode: "approvals" | "payments";
  expenses: Expense[];
  users: User[];
  onOpen: (expense: Expense) => void;
}) {
  const [tab, setTab] = useState<
    "all" | "pending" | "review" | "returned" | "scheduled" | "approved" | "paid"
  >("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const byTab = expenses.filter((item) => {
      switch (tab) {
        case "all":
          return true;
        case "pending":
          return item.status === "enviada";
        case "review":
          return item.status === "em_analise";
        case "returned":
          return item.status === "aguardando_documentacao";
        case "scheduled":
          return item.status === "agendada";
        case "approved":
          return item.status === "aprovada";
        case "paid":
          return item.status === "paga";
        default: {
          const exhaustive: never = tab;
          return exhaustive;
        }
      }
    });
    return byTab.filter((item) =>
      `${item.title} ${item.beneficiary_name}`.toLowerCase().includes(query.toLowerCase()),
    );
  }, [expenses, query, tab]);

  const inReview = expenses.filter((item) =>
    ["enviada", "em_analise", "aguardando_documentacao"].includes(item.status),
  );
  const waitingPay = expenses.filter((item) => ["aprovada", "agendada"].includes(item.status));
  const paid = expenses.filter((item) => item.status === "paga");

  const counts = {
    pending: expenses.filter((item) => item.status === "enviada").length,
    review: expenses.filter((item) => item.status === "em_analise").length,
    returned: expenses.filter((item) => item.status === "aguardando_documentacao").length,
    scheduled: expenses.filter((item) => item.status === "agendada").length,
    approved: expenses.filter((item) => item.status === "aprovada").length,
    paid: paid.length,
  };

  return (
    <div className="page-stack">
      <section className="page-title-row">
        <div>
          <span className="eyebrow">FINANCEIRO DIRETO</span>
          <h2>{mode === "approvals" ? "Central de aprovação" : "Pagamentos"}</h2>
          <p>
            {mode === "approvals"
              ? "Analise documentos e decida com rapidez e segurança."
              : "Agende, conclua e anexe o comprovante final."}
          </p>
        </div>
      </section>
      <section className="finance-kpis">
        <article>
          <div className="finance-icon violet">
            <Clock3 size={19} />
          </div>
          <div>
            <small>Na fila de análise</small>
            <strong>{inReview.length}</strong>
            <em>{money(inReview.reduce((sum, item) => sum + item.amount, 0))}</em>
          </div>
        </article>
        <article>
          <div className="finance-icon amber">
            <Wallet size={19} />
          </div>
          <div>
            <small>Aguardando pagamento</small>
            <strong>{waitingPay.length}</strong>
            <em>{money(waitingPay.reduce((sum, item) => sum + item.amount, 0))}</em>
          </div>
        </article>
        <article>
          <div className="finance-icon emerald">
            <CheckCircle2 size={19} />
          </div>
          <div>
            <small>Pagas no período</small>
            <strong>{paid.length}</strong>
            <em>{money(paid.reduce((sum, item) => sum + item.amount, 0))}</em>
          </div>
        </article>
      </section>
      <section className="panel data-panel">
        <div className="finance-tabs-flow">
          <div className="finance-flow-scroll">
            <button className={tab === "all" ? "active" : ""} onClick={() => setTab("all")}>
              Todas <span>{expenses.length}</span>
            </button>
            <button className={tab === "pending" ? "active" : ""} onClick={() => setTab("pending")}>
              1. Enviada {counts.pending > 0 ? <span>{counts.pending}</span> : null}
            </button>
            <button className={tab === "review" ? "active" : ""} onClick={() => setTab("review")}>
              2. Em análise {counts.review > 0 ? <span>{counts.review}</span> : null}
            </button>
            <button className={tab === "returned" ? "active" : ""} onClick={() => setTab("returned")}>
              3. Devolvido {counts.returned > 0 ? <span>{counts.returned}</span> : null}
            </button>
            <button className={tab === "scheduled" ? "active" : ""} onClick={() => setTab("scheduled")}>
              4. Agendado {counts.scheduled > 0 ? <span>{counts.scheduled}</span> : null}
            </button>
            <button className={tab === "approved" ? "active" : ""} onClick={() => setTab("approved")}>
              5. Aprovado {counts.approved > 0 ? <span>{counts.approved}</span> : null}
            </button>
            <button className={tab === "paid" ? "active" : ""} onClick={() => setTab("paid")}>
              6. Pago {counts.paid > 0 ? <span>{counts.paid}</span> : null}
            </button>
          </div>
        </div>
        <div className="finance-tabs">
          <label>
            <Search size={14} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar"
            />
          </label>
        </div>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <strong>
              {expenses.length === 0 ? "Nenhuma solicitação neste negócio." : "Tudo em dia por aqui"}
            </strong>
            <span>
              {expenses.length === 0
                ? "O fluxo começa vazio para você testar com dados reais."
                : "Não há solicitações nessa etapa."}
            </span>
          </div>
        ) : (
          <div className="approval-list">
            {filtered.map((item) => {
              const days = daysUntil(item.max_payment_date);
              const requester = users.find((user) => user.id === item.requester);
              return (
                <article className="approval-card" key={item.id}>
                  <button className="requester-avatar" onClick={() => onOpen(item)}>
                    {(requester?.name || "RO").slice(0, 2).toUpperCase()}
                  </button>
                  <div className="approval-main">
                    <div className="approval-title">
                      <button onClick={() => onOpen(item)}>
                        <strong>{item.title}</strong>
                        <span>
                          #{shortId(item.id)} • {item.category}
                        </span>
                      </button>
                      <StatusBadge status={item.status} />
                    </div>
                    <p>{item.description}</p>
                    <div className="approval-meta">
                      <span>
                        <small>Solicitante</small>
                        <strong>{requester?.name || "—"}</strong>
                      </span>
                      <span>
                        <small>Beneficiário</small>
                        <strong>{item.beneficiary_name}</strong>
                      </span>
                      <span>
                        <small>Prazo</small>
                        <strong>{days < 0 ? "Encerrado" : `${days} dias`}</strong>
                      </span>
                    </div>
                  </div>
                  <div className="approval-value">
                    <small>Valor solicitado</small>
                    <strong>{money(item.amount)}</strong>
                    <span>
                      <CalendarDays size={12} /> {item.max_payment_date}
                    </span>
                  </div>
                  <div className="approval-actions">
                    <button className="view-action" onClick={() => onOpen(item)}>
                      Ver detalhes
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
