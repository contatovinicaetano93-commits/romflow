"use client";

import { useMemo, useState } from "react";
import { Search, Shield } from "lucide-react";
import { AUDIT_LABEL, formatDateTime, initials } from "@/lib/format";
import type { AuditLog, User } from "@/lib/types";

export function AuditPage({ logs, users }: { logs: AuditLog[]; users: User[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () =>
      logs.filter((item) => {
        const actor = users.find((user) => user.id === item.user);
        return `${actor?.name ?? ""} ${AUDIT_LABEL[item.action]} ${item.resource}`
          .toLowerCase()
          .includes(query.toLowerCase());
      }),
    [logs, query, users],
  );
  const uniqueUsers = new Set(logs.map((item) => item.user)).size;

  return (
    <div className="page-stack">
      <section className="page-title-row">
        <div>
          <span className="eyebrow">GOVERNANÇA</span>
          <h2>Log de auditoria</h2>
          <p>Rastreabilidade completa de alterações em todo o fluxo financeiro.</p>
        </div>
      </section>
      <section className="audit-summary">
        <article>
          <Shield size={18} />
          <div>
            <strong>{logs.length}</strong>
            <span>eventos registrados</span>
          </div>
        </article>
        <article>
          <Shield size={18} />
          <div>
            <strong>{uniqueUsers}</strong>
            <span>usuários ativos no log</span>
          </div>
        </article>
        <article>
          <Shield size={18} />
          <div>
            <strong>{logs.length === 0 ? "—" : "100%"}</strong>
            <span>{logs.length === 0 ? "aguardando eventos" : "ações rastreadas"}</span>
          </div>
        </article>
      </section>
      <section className="panel data-panel">
        <div className="filter-bar">
          <div className="table-search">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar evento"
            />
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <strong>Nenhum evento registrado</strong>
          </div>
        ) : (
          <div className="expense-table-wrap">
            <table className="expense-table audit-table">
              <thead>
                <tr>
                  <th>Data e hora</th>
                  <th>Responsável</th>
                  <th>Ação</th>
                  <th>Recurso</th>
                  <th>Antes → Depois</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const actor = users.find((user) => user.id === item.user);
                  return (
                    <tr key={item.id}>
                      <td>{formatDateTime(item.created)}</td>
                      <td>
                        <div className="audit-user">
                          <i>{initials(actor?.name || "RO")}</i>
                          <span>
                            <strong>{actor?.name || "Sistema"}</strong>
                            <small>{actor?.email}</small>
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="audit-action">{AUDIT_LABEL[item.action]}</span>
                      </td>
                      <td>
                        <code>{item.resource}</code>
                      </td>
                      <td>
                        {item.before} → {item.after}
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
