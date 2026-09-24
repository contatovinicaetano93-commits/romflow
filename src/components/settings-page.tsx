"use client";

import { FormEvent, useState } from "react";
import { Building2, Pencil, Plus, Tags } from "lucide-react";
import { cls } from "@/lib/format";
import { assertNever, type Category, type Company } from "@/lib/types";

export function SettingsPage({
  companies,
  categories,
  onCreateCompany,
  onCreateCategory,
  onUpdateCategory,
  onToggleCategory,
  onToggleCompany,
}: {
  companies: Company[];
  categories: Category[];
  onCreateCompany: (input: { name: string; color: string }) => void | Promise<void>;
  onCreateCategory: (input: { name: string; color: string }) => void | Promise<void>;
  onUpdateCategory: (id: string, patch: Pick<Category, "name" | "color">) => void | Promise<void>;
  onToggleCategory: (id: string, is_active: boolean) => void | Promise<void>;
  onToggleCompany: (id: string, is_active: boolean) => void | Promise<void>;
}) {
  const [modal, setModal] = useState<"company" | "category" | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [pendingCompany, setPendingCompany] = useState<Company | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#10B981");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const activeCompanies = companies.filter((item) => item.is_active).length;

  function closeModal() {
    setModal(null);
    setEditingCategory(null);
    setName("");
    setColor("#10B981");
    setError("");
  }

  function openCreate(kind: "company" | "category") {
    setEditingCategory(null);
    setName("");
    setColor("#10B981");
    setError("");
    setModal(kind);
  }

  function openEditCategory(category: Category) {
    setEditingCategory(category);
    setName(category.name);
    setColor(category.color);
    setError("");
    setModal("category");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!modal || busy) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      switch (modal) {
        case "company":
          await onCreateCompany({ name, color });
          setSuccess("Empresa adicionada.");
          break;
        case "category":
          if (editingCategory) {
            await onUpdateCategory(editingCategory.id, { name, color });
            setSuccess("Categoria atualizada.");
          } else {
            await onCreateCategory({ name, color });
            setSuccess("Categoria adicionada.");
          }
          break;
        default:
          assertNever(modal);
      }
      closeModal();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleCompany(company: Company) {
    const nextActive = !company.is_active;
    if (company.is_active && activeCompanies <= 1) {
      setError("É preciso manter ao menos uma empresa ativa.");
      return;
    }
    if (company.is_active) {
      setPendingCompany(company);
      setError("");
      return;
    }
    setError("");
    try {
      await onToggleCompany(company.id, nextActive);
      setSuccess(`${company.name} reativada.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível atualizar a empresa.");
    }
  }

  async function confirmDeactivate() {
    if (!pendingCompany) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onToggleCompany(pendingCompany.id, false);
      setSuccess(`${pendingCompany.name} desativada. Solicitações novas ficam bloqueadas.`);
      setPendingCompany(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível desativar a empresa.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="page-title-row">
        <div>
          <span className="eyebrow">ADMINISTRAÇÃO</span>
          <h2>Configurações do grupo</h2>
          <p>Gerencie empresas, categorias e parâmetros essenciais do ROM Flow.</p>
        </div>
      </section>
      {success ? <div className="success-banner">{success}</div> : null}
      {error && !modal && !pendingCompany ? <div className="form-error">{error}</div> : null}
      <section className="settings-grid">
        <article className="panel settings-card">
          <header>
            <div className="settings-icon pink">
              <Building2 size={19} />
            </div>
            <div>
              <h3>Empresas do Grupo ROM</h3>
              <p>{companies.length} unidades cadastradas</p>
            </div>
            <button type="button" onClick={() => openCreate("company")}>
              <Plus size={13} /> Nova
            </button>
          </header>
          <div className="settings-list">
            {companies.map((company) => {
              const lastActive = company.is_active && activeCompanies <= 1;
              return (
                <div key={company.id}>
                  <i style={{ background: company.color }}>{company.initials}</i>
                  <span>
                    <strong>{company.name}</strong>
                    <small>{company.legal_name}</small>
                  </span>
                  <button
                    type="button"
                    disabled={lastActive}
                    title={lastActive ? "É preciso manter ao menos uma empresa ativa." : undefined}
                    onClick={() => void handleToggleCompany(company)}
                  >
                    <em className={cls(company.is_active && "active")}>
                      {company.is_active ? "Ativa" : "Inativa"}
                    </em>
                  </button>
                </div>
              );
            })}
          </div>
        </article>
        <article className="panel settings-card">
          <header>
            <div className="settings-icon emerald">
              <Tags size={19} />
            </div>
            <div>
              <h3>Categorias de despesas</h3>
              <p>{categories.filter((item) => item.is_active).length} categorias disponíveis</p>
            </div>
            <button type="button" onClick={() => openCreate("category")}>
              <Plus size={13} /> Nova
            </button>
          </header>
          <div className="settings-list">
            {categories.map((category) => (
              <div key={category.id}>
                <i className="category-dot" style={{ background: category.color }} />
                <span>
                  <strong>{category.name}</strong>
                  <small>Disponível nos formulários</small>
                </span>
                <div className="settings-row-actions">
                  <button type="button" aria-label={`Editar ${category.name}`} onClick={() => openEditCategory(category)}>
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void (async () => {
                        try {
                          await onToggleCategory(category.id, !category.is_active);
                          setError("");
                        } catch (caught) {
                          setError(
                            caught instanceof Error
                              ? caught.message
                              : "Não foi possível atualizar a categoria.",
                          );
                        }
                      })();
                    }}
                  >
                    <em className={cls(category.is_active && "active")}>
                      {category.is_active ? "Ativa" : "Inativa"}
                    </em>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      {modal ? (
        <div className="modal-layer">
          <button className="modal-overlay" onClick={() => !busy && closeModal()} />
          <form className="action-modal" onSubmit={handleSubmit}>
            <header>
              <div className="modal-icon emerald">
                {modal === "company" ? <Building2 size={20} /> : editingCategory ? <Pencil size={20} /> : <Tags size={20} />}
              </div>
              <div>
                <h3>
                  {modal === "company"
                    ? "Nova empresa"
                    : editingCategory
                      ? "Editar categoria"
                      : "Nova categoria"}
                </h3>
                <p>
                  {editingCategory
                    ? "O nome novo vale nos formulários e nas solicitações já cadastradas."
                    : "Parâmetros essenciais do ROM Flow"}
                </p>
              </div>
            </header>
            {error ? <div className="form-error">{error}</div> : null}
            <label>
              Nome <span>*</span>
              <input value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
            <label>
              Cor
              <input type="color" value={color} onChange={(event) => setColor(event.target.value)} />
            </label>
            <footer>
              <button className="secondary-button" type="button" disabled={busy} onClick={closeModal}>
                Cancelar
              </button>
              <button className="primary-button" disabled={busy}>
                {busy ? "Salvando..." : "Salvar"}
              </button>
            </footer>
          </form>
        </div>
      ) : null}

      {pendingCompany ? (
        <div className="modal-layer">
          <button className="modal-overlay" onClick={() => !busy && setPendingCompany(null)} />
          <div className="action-modal">
            <header>
              <div className="modal-icon">
                <Building2 size={20} />
              </div>
              <div>
                <h3>Desativar {pendingCompany.name}?</h3>
                <p className="modal-lead">
                  Ela sai do seletor e não recebe solicitações novas. As que já existem continuam no fluxo.
                </p>
              </div>
            </header>
            {error ? <div className="form-error">{error}</div> : null}
            <footer>
              <button
                className="secondary-button"
                type="button"
                disabled={busy}
                onClick={() => setPendingCompany(null)}
              >
                Cancelar
              </button>
              <button className="danger-button" type="button" disabled={busy} onClick={() => void confirmDeactivate()}>
                {busy ? "Desativando..." : "Desativar empresa"}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
