"use client";

import { FormEvent, useMemo, useState } from "react";
import { Check, Copy, Link2, Mail, Pencil, Search, Shield, UserPlus, Users } from "lucide-react";
import { ROLE_CLASS, ROLE_LABEL, cls, formatDate } from "@/lib/format";
import type { Company, Invitation, Role, User } from "@/lib/types";

function signupUrl(token: string) {
  return `${window.location.origin}/convite?token=${token}`;
}

function assignedCompanies(ids: string[], companies: Company[]): Company[] {
  return ids
    .map((id) => companies.find((item) => item.id === id))
    .filter((item): item is Company => Boolean(item));
}

function CompanyChips({ ids, companies }: { ids: string[]; companies: Company[] }) {
  const assigned = assignedCompanies(ids, companies);
  if (assigned.length === 0) {
    return <span className="no-companies-tag">Nenhuma empresa atribuída</span>;
  }
  return (
    <div className="user-companies-chips">
      {assigned.map((company) => (
        <span key={company.id} className="company-badge-pill" style={{ borderLeftColor: company.color }}>
          {company.name}
        </span>
      ))}
    </div>
  );
}

function CompanyPicker({
  companies,
  selected,
  onChange,
}: {
  companies: Company[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="company-selection-group">
      <div className="company-selection-header">
        <p className="company-selection-label">Empresas de acesso</p>
        <div className="company-selection-actions">
          <button type="button" onClick={() => onChange(companies.map((item) => item.id))}>
            Marcar todas
          </button>
          <span>•</span>
          <button type="button" onClick={() => onChange([])}>
            Desmarcar
          </button>
        </div>
      </div>
      <div className="company-checkbox-grid">
        {companies.map((company) => {
          const checked = selected.includes(company.id);
          return (
            <label key={company.id} className={cls("company-checkbox-card", checked && "checked")}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() =>
                  onChange(
                    checked
                      ? selected.filter((id) => id !== company.id)
                      : [...selected, company.id],
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
      <p className="signup-field-hint">
        O usuário só vê e opera nas empresas marcadas. Selecione ao menos uma.
      </p>
    </div>
  );
}

type EditingTarget =
  | { kind: "user"; user: User }
  | { kind: "invitation"; invitation: Invitation };

export function UsersPage({
  users,
  invitations,
  companies,
  currentUserId,
  onInvite,
  onUpdateUser,
  onUpdateInvitation,
  onToggle,
}: {
  users: User[];
  invitations: Invitation[];
  companies: Company[];
  currentUserId: string;
  onInvite: (
    email: string,
    role: Role,
    companyIds: string[],
  ) => Promise<Invitation & { emailSent?: boolean; emailError?: string }>;
  onUpdateUser: (userId: string, role: Role, companyIds: string[]) => Promise<void>;
  onUpdateInvitation: (invitationId: string, role: Role, companyIds: string[]) => Promise<void>;
  onToggle: (userId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("solicitante");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{ email: string; link: string } | null>(null);
  const [editing, setEditing] = useState<EditingTarget | null>(null);
  const [editRole, setEditRole] = useState<Role>("solicitante");
  const [editSelected, setEditSelected] = useState<string[]>([]);
  const [editError, setEditError] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  const pendingInvites = useMemo(
    () => invitations.filter((item) => !item.accepted),
    [invitations],
  );

  const filtered = useMemo(
    () =>
      users.filter((item) =>
        `${item.name} ${item.email} ${item.role}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [query, users],
  );

  function closeModal() {
    setOpen(false);
    setEmail("");
    setSelected([]);
    setError("");
    setCreated(null);
    setSubmitting(false);
    setRole("solicitante");
  }

  function closeEdit() {
    setEditing(null);
    setEditError("");
    setEditSubmitting(false);
  }

  function startUserEdit(user: User) {
    setOpen(false);
    setEditing({ kind: "user", user });
    setEditRole(user.role);
    setEditSelected([...user.companyIds]);
    setEditError("");
  }

  function startInviteEdit(invitation: Invitation) {
    setOpen(false);
    setEditing({ kind: "invitation", invitation });
    setEditRole(invitation.role);
    setEditSelected([...invitation.companyIds]);
    setEditError("");
  }

  async function copyLink(link: string, id: string) {
    await navigator.clipboard.writeText(link);
    setCopied(id);
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (selected.length === 0) {
      setError("Selecione ao menos uma empresa de acesso.");
      return;
    }
    setSubmitting(true);
    try {
      const invitation = await onInvite(email, role, selected);
      const link = signupUrl(invitation.token);
      setCreated({ email: invitation.email, link });
      await copyLink(link, "created");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível concluir a operação.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEdit(event: FormEvent) {
    event.preventDefault();
    if (!editing) {
      return;
    }
    setEditError("");
    if (editSelected.length === 0) {
      setEditError("Selecione ao menos uma empresa de acesso.");
      return;
    }
    setEditSubmitting(true);
    try {
      switch (editing.kind) {
        case "user":
          await onUpdateUser(editing.user.id, editRole, editSelected);
          break;
        case "invitation":
          await onUpdateInvitation(editing.invitation.id, editRole, editSelected);
          break;
        default: {
          const unexpected: never = editing;
          throw new Error(`Edição não suportada: ${JSON.stringify(unexpected)}`);
        }
      }
      closeEdit();
    } catch (caught) {
      setEditError(caught instanceof Error ? caught.message : "Não foi possível salvar o acesso.");
    } finally {
      setEditSubmitting(false);
    }
  }

  const editingTitle = editing
    ? editing.kind === "user"
      ? `Editar acesso de ${editing.user.name}`
      : `Editar convite de ${editing.invitation.email}`
    : "";

  return (
    <div className="page-stack">
      <section className="page-title-row">
        <div>
          <span className="eyebrow">ACESSO E SEGURANÇA</span>
          <h2>Gestão de usuários</h2>
          <p>
            Crie o usuário pelo e-mail, defina o perfil e as empresas permitidas. Depois você pode
            editar esses acessos a qualquer momento.
          </p>
        </div>
        <button
          className="primary-button"
          onClick={() => {
            setCreated(null);
            setError("");
            setOpen(true);
          }}
        >
          <UserPlus size={16} /> Criar usuário
        </button>
      </section>
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
          <Link2 size={18} />
          <div>
            <strong>{pendingInvites.length}</strong>
            <span>Cadastros pendentes</span>
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
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
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
                    <CompanyChips ids={item.companyIds} companies={companies} />
                  </td>
                  <td>
                    <span className={`user-status ${item.status}`}>
                      <i /> {item.status === "active" ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td>{formatDate(item.created)}</td>
                  <td>
                    <div className="user-row-actions">
                      <button className="secondary-button" type="button" onClick={() => startUserEdit(item)}>
                        <Pencil size={14} /> Editar
                      </button>
                      <button
                        className={cls("switch-button", item.status === "active" && "on")}
                        disabled={item.id === currentUserId}
                        onClick={() => onToggle(item.id)}
                      >
                        <i /> {item.status === "active" ? "Ativo" : "Inativo"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel invitation-panel">
        <header>
          <h3>Cadastros pendentes</h3>
        </header>
        {pendingInvites.length === 0 ? (
          <div className="empty-state">
            <strong>Nenhum cadastro pendente</strong>
            <span>Quando você criar um usuário, o link de senha aparece aqui até a pessoa finalizar.</span>
          </div>
        ) : (
          pendingInvites.map((item) => {
            const link = signupUrl(item.token);
            return (
              <div key={item.id}>
                <Mail size={18} />
                <span>
                  <strong>{item.email}</strong>
                  <small>
                    {ROLE_LABEL[item.role]} • Aguardando a pessoa cadastrar a senha
                  </small>
                  <div className="invitation-companies">
                    <CompanyChips ids={item.companyIds} companies={companies} />
                  </div>
                </span>
                <div className="invitation-actions">
                  <button className="secondary-button" type="button" onClick={() => startInviteEdit(item)}>
                    <Pencil size={14} /> Editar
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => void copyLink(link, item.id)}
                  >
                    {copied === item.id ? <Check size={14} /> : <Copy size={14} />}
                    {copied === item.id ? "Link copiado" : "Copiar link"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </section>

      {open ? (
        <div className="modal-layer">
          <button className="modal-overlay" onClick={closeModal} />
          {created ? (
            <div className="action-modal signup-share-modal">
              <header>
                <div className="modal-icon emerald">
                  <Link2 size={20} />
                </div>
                <div>
                  <h3>Usuário criado</h3>
                  <p className="modal-lead">
                    Envie este link para {created.email}. A pessoa informa o nome e cadastra a senha.
                  </p>
                </div>
              </header>
              <div className="signup-link-box">
                <code>{created.link}</code>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => void copyLink(created.link, "created")}
                >
                  {copied === "created" ? <Check size={16} /> : <Copy size={16} />}
                  {copied === "created" ? "Link copiado" : "Copiar link"}
                </button>
              </div>
              <p className="signup-link-hint">
                O link já foi copiado. Você pode colar no WhatsApp, e-mail ou qualquer outro canal.
              </p>
              <footer>
                <button className="secondary-button" type="button" onClick={closeModal}>
                  Fechar
                </button>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => {
                    setCreated(null);
                    setEmail("");
                    setSelected([]);
                    setError("");
                    setCopied("");
                  }}
                >
                  Criar outro
                </button>
              </footer>
            </div>
          ) : (
            <form className="action-modal" onSubmit={handleCreate}>
              <header>
                <div className="modal-icon emerald">
                  <UserPlus size={20} />
                </div>
                <div>
                  <h3>Criar usuário</h3>
                  <p className="modal-lead">
                    Informe o e-mail, o perfil e as empresas. Depois copie o link para a pessoa
                    finalizar o cadastro.
                  </p>
                </div>
              </header>
              <label>
                E-mail <span>*</span>
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
                  <option value="solicitante">Solicitante</option>
                  <option value="financeiro">Financeiro</option>
                  <option value="admin">Administrador</option>
                </select>
              </label>
              <CompanyPicker companies={companies} selected={selected} onChange={setSelected} />
              {error ? <div className="form-error">{error}</div> : null}
              <footer>
                <button className="secondary-button" type="button" onClick={closeModal}>
                  Cancelar
                </button>
                <button className="primary-button" disabled={submitting}>
                  {submitting ? <span className="spinner" /> : null}
                  {submitting ? "Criando..." : "Criar e gerar link"}
                </button>
              </footer>
            </form>
          )}
        </div>
      ) : null}

      {editing ? (
        <div className="modal-layer">
          <button className="modal-overlay" onClick={closeEdit} />
          <form className="action-modal" onSubmit={handleEdit}>
            <header>
              <div className="modal-icon emerald">
                <Pencil size={20} />
              </div>
              <div>
                <h3>{editingTitle}</h3>
                <p className="modal-lead">
                  Altere o perfil e as empresas permitidas. A mudança vale na próxima sessão da
                  pessoa.
                </p>
              </div>
            </header>
            {editing.kind === "user" ? (
              <label>
                E-mail
                <input value={editing.user.email} readOnly />
              </label>
            ) : (
              <label>
                E-mail
                <input value={editing.invitation.email} readOnly />
              </label>
            )}
            <label>
              Perfil
              <select value={editRole} onChange={(event) => setEditRole(event.target.value as Role)}>
                <option value="solicitante">Solicitante</option>
                <option value="financeiro">Financeiro</option>
                <option value="admin">Administrador</option>
              </select>
            </label>
            <CompanyPicker companies={companies} selected={editSelected} onChange={setEditSelected} />
            {editError ? <div className="form-error">{editError}</div> : null}
            <footer>
              <button className="secondary-button" type="button" onClick={closeEdit}>
                Cancelar
              </button>
              <button className="primary-button" disabled={editSubmitting}>
                {editSubmitting ? <span className="spinner" /> : null}
                {editSubmitting ? "Salvando..." : "Salvar acessos"}
              </button>
            </footer>
          </form>
        </div>
      ) : null}
    </div>
  );
}
