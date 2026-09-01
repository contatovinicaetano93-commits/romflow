"use client";

import { FormEvent, useMemo, useState } from "react";
import { Copy, Mail, Search, Shield, UserPlus, Users } from "lucide-react";
import { ROLE_CLASS, ROLE_LABEL, cls, formatDate } from "@/lib/format";
import type { Company, Invitation, Role, User } from "@/lib/types";

export function UsersPage({
  users,
  invitations,
  companies,
  onInvite,
  onToggle,
}: {
  users: User[];
  invitations: Invitation[];
  companies: Company[];
  onInvite: (email: string, role: Role, companyIds: string[]) => Invitation;
  onToggle: (userId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("solicitante");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [copied, setCopied] = useState("");

  const filtered = useMemo(
    () =>
      users.filter((item) =>
        `${item.name} ${item.email} ${item.role}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [query, users],
  );

  function handleInvite(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (role === "solicitante" && selected.length === 0) {
      setError("Selecione ao menos uma empresa para o Solicitante.");
      return;
    }
    try {
      const invitation = onInvite(
        email,
        role,
        role === "solicitante" || selected.length > 0 ? selected : companies.map((item) => item.id),
      );
      setSuccess(
        `Convite enviado para ${email}! Link de ativação: ${window.location.origin}/convite?token=${invitation.token}`,
      );
      setEmail("");
      setSelected([]);
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível concluir a operação.");
    }
  }

  function companyNames(ids: string[]) {
    if (ids.length === 0 || ids.length === companies.length) {
      return null;
    }
    return ids
      .map((id) => companies.find((item) => item.id === id))
      .filter(Boolean) as Company[];
  }

  return (
    <div className="page-stack">
      <section className="page-title-row">
        <div>
          <span className="eyebrow">ACESSO E SEGURANÇA</span>
          <h2>Gestão de usuários</h2>
          <p>Novos acessos são criados exclusivamente por convite.</p>
        </div>
        <button className="primary-button" onClick={() => setOpen(true)}>
          <UserPlus size={16} /> Convidar novo usuário
        </button>
      </section>
      {success ? <div className="success-banner">{success}</div> : null}
      {error && !open ? <div className="form-error">{error}</div> : null}
      <section className="user-kpis">
        <article>
          <Users size={18} />
          <div>
            <strong>{users.length}</strong>
            <span>Usuários cadastrados</span>
          </div>
        </article>
        <article>
          <Shield size={18} />
          <div>
            <strong>{users.filter((item) => item.status === "active").length}</strong>
            <span>Acessos ativos</span>
          </div>
        </article>
        <article>
          <Mail size={18} />
          <div>
            <strong>{invitations.filter((item) => !item.accepted).length}</strong>
            <span>Convites pendentes</span>
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
              placeholder="Buscar usuário"
            />
          </div>
        </div>
        <div className="expense-table-wrap">
          <table className="expense-table">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Perfil</th>
                <th>Empresas permitidas</th>
                <th>Status</th>
                <th>Cadastro</th>
                <th>Kill Switch</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const assigned = companyNames(item.companyIds);
                return (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.name}</strong>
                      <small className="table-subline">{item.email}</small>
                    </td>
                    <td>
                      <span className={`role-badge ${ROLE_CLASS[item.role]}`}>
                        {ROLE_LABEL[item.role]}
                      </span>
                    </td>
                    <td>
                      {item.role !== "solicitante" || !assigned ? (
                        <span className="all-companies-tag">Todas as empresas</span>
                      ) : assigned.length === 0 ? (
                        <span className="no-companies-tag">Nenhuma empresa atribuída</span>
                      ) : (
                        <div className="user-companies-chips">
                          {assigned.map((company) => (
                            <span
                              key={company.id}
                              className="company-badge-pill"
                              style={{ borderLeftColor: company.color }}
                            >
                              {company.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`user-status ${item.status}`}>
                        <i /> {item.status === "active" ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td>{formatDate(item.created)}</td>
                    <td>
                      <button
                        className={cls("switch-button", item.status === "active" && "on")}
                        onClick={() => onToggle(item.id)}
                      >
                        <i /> {item.status === "active" ? "Ativo" : "Inativo"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel invitation-panel">
        <header>
          <h3>Convites recentes</h3>
        </header>
        {invitations.length === 0 ? (
          <div className="empty-state">
            <strong>Nenhum convite</strong>
          </div>
        ) : (
          invitations.map((item) => (
            <div key={item.id}>
              <Mail size={18} />
              <span>
                <strong>{item.email}</strong>
                <small>
                  {ROLE_LABEL[item.role]} • {item.accepted ? "Aceito" : "Pendente"}
                </small>
              </span>
              {!item.accepted ? (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={async () => {
                    const url = `${window.location.origin}/convite?token=${item.token}`;
                    await navigator.clipboard.writeText(url);
                    setCopied(item.id);
                  }}
                >
                  <Copy size={14} /> {copied === item.id ? "Copiado" : "Copiar / abrir link de ativação"}
                </button>
              ) : (
                <em>Ativado</em>
              )}
            </div>
          ))
        )}
      </section>

      {open ? (
        <div className="modal-layer">
          <button className="modal-overlay" onClick={() => setOpen(false)} />
          <form className="action-modal" onSubmit={handleInvite}>
            <header>
              <div className="modal-icon emerald">
                <UserPlus size={20} />
              </div>
              <div>
                <h3>Convidar novo usuário</h3>
                <p>O acesso será liberado por convite seguro.</p>
              </div>
            </header>
            <label>
              E-mail corporativo <span>*</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label>
              Perfil
              <select value={role} onChange={(event) => setRole(event.target.value as Role)}>
                <option value="solicitante">Solicitante (escopo restrito por empresa)</option>
                <option value="financeiro">Financeiro</option>
                <option value="admin">Administrador</option>
              </select>
            </label>
            <div className="company-selection-group">
              <div className="company-selection-header">
                <p className="company-selection-label">Empresas</p>
                <div className="company-selection-actions">
                  <button type="button" onClick={() => setSelected(companies.map((item) => item.id))}>
                    Marcar todas
                  </button>
                  <span>•</span>
                  <button type="button" onClick={() => setSelected([])}>
                    Desmarcar
                  </button>
                </div>
              </div>
              <div className="company-checkbox-grid">
                {companies.map((company) => {
                  const checked = selected.includes(company.id);
                  return (
                    <label
                      key={company.id}
                      className={cls("company-checkbox-card", checked && "checked")}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSelected((current) =>
                            current.includes(company.id)
                              ? current.filter((id) => id !== company.id)
                              : [...current, company.id],
                          )
                        }
                      />
                      <i className="company-dot" style={{ background: company.color }} />
                      <span className="company-info">
                        <strong>{company.name}</strong>
                        <small>{company.legal_name}</small>
                      </span>
                    </label>
                  );
                })}
              </div>
              {role === "solicitante" ? (
                <p className="field-hint-error">
                  O perfil Solicitante requer pelo menos uma empresa selecionada.
                </p>
              ) : null}
            </div>
            {error ? <div className="form-error">{error}</div> : null}
            <footer>
              <button className="secondary-button" type="button" onClick={() => setOpen(false)}>
                Cancelar
              </button>
              <button className="primary-button">Enviar convite</button>
            </footer>
          </form>
        </div>
      ) : null}
    </div>
  );
}
