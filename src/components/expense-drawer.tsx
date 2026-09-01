"use client";

import { FormEvent, useRef, useState } from "react";
import {
  Ban,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  FolderOpen,
  RotateCcw,
  Sparkles,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import {
  EXPENSE_TYPE_LABEL,
  PAYMENT_METHOD_LABEL,
  cls,
  formatDate,
  formatDateTime,
  money,
} from "@/lib/format";
import type {
  Expense,
  ExpenseStatus,
  FinanceAction,
  FinanceActionPayload,
  Role,
  StoredFile,
  User,
} from "@/lib/types";
import { assertNever } from "@/lib/types";
import { StatusBadge } from "./status-badge";

const FLOW: ExpenseStatus[] = [
  "enviada",
  "em_analise",
  "aguardando_documentacao",
  "aprovada",
  "agendada",
  "paga",
];

async function fileToStored(file: File): Promise<StoredFile> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Falha ao ler arquivo."));
    reader.readAsDataURL(file);
  });
  return { name: file.name, size: file.size, type: file.type, dataUrl };
}

export function ExpenseDrawer({
  expense,
  requester,
  companyName,
  role,
  onClose,
  onAction,
}: {
  expense: Expense;
  requester?: User;
  companyName: string;
  role: Role;
  onClose: () => void;
  onAction: (action: FinanceAction, payload?: FinanceActionPayload) => void | Promise<void>;
}) {
  const [modal, setModal] = useState<FinanceAction | null>(null);
  const [note, setNote] = useState("");
  const [scheduledDate, setScheduledDate] = useState(
    expense.scheduled_date ?? new Date().toISOString().slice(0, 10),
  );
  const [proof, setProof] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const canManage = role === "admin" || role === "financeiro";

  function statusIndex(status: ExpenseStatus): number {
    if (status === "recusada") {
      return -1;
    }
    return FLOW.indexOf(status);
  }

  async function confirm(event: FormEvent) {
    event.preventDefault();
    if (!modal) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const stored = proof ? await fileToStored(proof) : null;
      const payload: FinanceActionPayload = {};
      if (modal === "reject" || modal === "docs") {
        payload.note = note;
      }
      if (modal === "schedule") {
        payload.scheduledDate = scheduledDate;
      }
      if (modal === "pay") {
        payload.proof = stored;
      }
      if (modal === "resubmit") {
        payload.receipt = stored;
      }
      await onAction(modal, payload);
      setModal(null);
      setNote("");
      setProof(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível concluir a operação.");
    } finally {
      setBusy(false);
    }
  }

  function modalTitle(action: FinanceAction): string {
    switch (action) {
      case "review":
        return "Iniciar análise";
      case "docs":
        return "Devolver Solicitação para Ajustes";
      case "approve":
        return "Aprovar Solicitação";
      case "schedule":
        return "Agendar Data de Pagamento";
      case "pay":
        return "Confirmar Pagamento & Anexar Comprovante";
      case "reject":
        return "Recusar Solicitação";
      case "resubmit":
        return "Reenviar documentação";
      default:
        return assertNever(action);
    }
  }

  function confirmLabel(action: FinanceAction): string {
    switch (action) {
      case "review":
        return "Confirmar ação";
      case "docs":
        return "Confirmar Devolução";
      case "approve":
        return "Aprovar Solicitação";
      case "schedule":
        return "Confirmar Agendamento";
      case "pay":
        return "Concluir & Liberar Comprovante";
      case "reject":
        return "Confirmar Recusa";
      case "resubmit":
        return "Reenviar solicitação";
      default:
        return assertNever(action);
    }
  }

  const currentIndex = statusIndex(expense.status);

  return (
    <div className="drawer-layer">
      <button className="drawer-overlay" aria-label="Fechar detalhes" onClick={onClose} />
      <aside className="details-drawer">
        <header className="drawer-header">
          <div>
            <div className="drawer-header-tag">Solicitação #{expense.id.slice(-6).toUpperCase()}</div>
            <h2>{expense.title}</h2>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Fechar">
            <X size={16} />
          </button>
        </header>
        <div className="drawer-body">
          {expense.status === "paga" ? (
            <div className="details-alert success">Pagamento efetuado com comprovante</div>
          ) : null}
          {expense.status === "recusada" ? (
            <div className="details-alert error">Solicitação Recusada</div>
          ) : null}
          {expense.status === "aguardando_documentacao" ? (
            <div className="details-alert">
              {expense.review_note || "Devolvido para ajustes. Anexe os documentos e reenvie."}
            </div>
          ) : null}
          <div className="details-hero">
            <div className="hero-top-row">
              <StatusBadge status={expense.status} />
              <span className="hero-date">{formatDate(expense.max_payment_date)}</span>
            </div>
            <strong>{money(expense.amount)}</strong>
            {expense.scheduled_date ? (
              <span className="hero-scheduled-badge">
                <CalendarDays size={14} /> Agendado para {formatDate(expense.scheduled_date)}
              </span>
            ) : null}
          </div>

          {canManage ? (
            <div className="finance-actions-section">
              <div className="section-header-row">
                <h3>Ações do Financeiro</h3>
                <span className="role-pill">Controle de Fluxo</span>
              </div>
              <div className="finance-action-buttons">
                <button
                  className="action-pill-btn review"
                  disabled={!["enviada", "aguardando_documentacao"].includes(expense.status)}
                  onClick={() => setModal("review")}
                >
                  <Clock3 size={16} /> Em análise
                </button>
                <button
                  className="action-pill-btn return"
                  disabled={!["enviada", "em_analise"].includes(expense.status)}
                  onClick={() => setModal("docs")}
                >
                  <RotateCcw size={16} /> Devolver
                </button>
                <button
                  className="action-pill-btn approve"
                  disabled={!["enviada", "em_analise", "aguardando_documentacao"].includes(expense.status)}
                  onClick={() => setModal("approve")}
                >
                  <CheckCircle2 size={16} /> Aprovar
                </button>
                <button
                  className="action-pill-btn schedule"
                  disabled={!["aprovada"].includes(expense.status)}
                  onClick={() => setModal("schedule")}
                >
                  <CalendarDays size={16} /> Agendar
                </button>
                <button
                  className="action-pill-btn pay"
                  disabled={!["aprovada", "agendada"].includes(expense.status)}
                  onClick={() => setModal("pay")}
                >
                  <CheckCircle2 size={16} /> Pagar
                </button>
              </div>
              <div className="secondary-flow-actions">
                <button
                  className="btn-request-docs"
                  type="button"
                  disabled={expense.status === "paga" || expense.status === "recusada"}
                  onClick={() => setModal("docs")}
                >
                  Solicitar documentos
                </button>
                <button
                  className="btn-reject-expense"
                  type="button"
                  disabled={expense.status === "paga" || expense.status === "recusada"}
                  onClick={() => setModal("reject")}
                >
                  <Ban size={14} /> Recusar
                </button>
              </div>
            </div>
          ) : null}

          {expense.status === "aguardando_documentacao" ? (
            <div className="finance-actions-section">
              <div className="section-header-row">
                <h3>Ajustar documentação</h3>
              </div>
              <button className="primary-button" type="button" onClick={() => setModal("resubmit")}>
                <Upload size={16} /> Anexar e reenviar
              </button>
            </div>
          ) : null}

          <div className="details-section">
            <h3>Dados da despesa</h3>
            <div className="detail-cards-grid">
              <div className="detail-card">
                <FolderOpen className="card-icon" size={20} />
                <div className="card-content">
                  <small>Categoria</small>
                  <strong>{expense.category}</strong>
                </div>
              </div>
              <div className="detail-card">
                <Building2 className="card-icon" size={20} />
                <div className="card-content">
                  <small>Empresa</small>
                  <strong>{companyName}</strong>
                </div>
              </div>
              <div className="detail-card">
                <UserRound className="card-icon" size={20} />
                <div className="card-content">
                  <small>Solicitante</small>
                  <strong>{requester?.name ?? "—"}</strong>
                </div>
              </div>
              <div className="detail-card">
                <Sparkles className="card-icon" size={20} />
                <div className="card-content">
                  <small>Evento / Projeto</small>
                  <strong>{expense.event_project || "—"}</strong>
                </div>
              </div>
            </div>
            <p className="expense-description-text">{expense.description}</p>
          </div>

          <div className="details-section">
            <h3>Beneficiário</h3>
            <div className="beneficiary-table-card">
              <div className="beneficiary-table-row">
                <div className="beneficiary-cell">
                  <small>Nome / Razão social</small>
                  <strong>{expense.beneficiary_name}</strong>
                </div>
                <div className="beneficiary-cell">
                  <small>Forma de pagamento</small>
                  <strong>{PAYMENT_METHOD_LABEL[expense.payment_method]}</strong>
                </div>
              </div>
              <div className="beneficiary-table-row border-top">
                <div className="beneficiary-cell">
                  <small>Documento</small>
                  <strong>{expense.beneficiary_document || "—"}</strong>
                </div>
                <div className="beneficiary-cell">
                  <small>Chave / Conta</small>
                  <strong>
                    {expense.pix_key ||
                      expense.boleto_code ||
                      [expense.agency, expense.account].filter(Boolean).join(" / ") ||
                      "—"}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          <div className="details-section">
            <div className="section-header-row">
              <h3>Documentos</h3>
              {expense.payment_proof ? (
                <span className="proof-ready-badge">
                  <CheckCircle2 size={14} /> Comprovante
                </span>
              ) : null}
            </div>
            {expense.receipt ? (
              <div className="document-item-card">
                <div className="doc-icon-wrap">
                  <FileText className="text-violet" size={18} />
                </div>
                <div className="doc-meta">
                  <strong title={expense.receipt.name}>{expense.receipt.name}</strong>
                  <small>Nota fiscal / documento</small>
                </div>
                <div className="doc-actions">
                  {expense.receipt.dataUrl ? (
                    <a
                      className="doc-action-btn download"
                      href={expense.receipt.dataUrl}
                      download={expense.receipt.name}
                    >
                      <Download size={16} />
                    </a>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="empty-docs-box">
                <FileText size={18} />
                {expense.receipt_justification || "Nenhum documento anexado para esta solicitação."}
              </div>
            )}
            {expense.payment_proof ? (
              <div className="document-item-card proof-card">
                <div className="doc-icon-wrap proof">
                  <FileText className="text-emerald" size={18} />
                </div>
                <div className="doc-meta">
                  <strong title={expense.payment_proof.name}>{expense.payment_proof.name}</strong>
                  <small className="text-emerald">Comprovante de pagamento oficial</small>
                </div>
              </div>
            ) : null}
          </div>

          <div className="details-section">
            <h3>Linha do tempo & Histórico</h3>
            {expense.status === "recusada" ? (
              <div className="timeline-step">
                <div className="step-indicator reject">
                  <Ban size={14} />
                </div>
                <div className="step-body">
                  <strong>Solicitação Recusada</strong>
                  <small>{expense.review_note || formatDateTime(expense.updated)}</small>
                </div>
              </div>
            ) : null}
            {FLOW.map((status, index) => {
              const completed = currentIndex >= index && expense.status !== "recusada";
              const current = currentIndex === index;
              return (
                <div
                  className={cls("timeline-step", completed && "completed", current && "current")}
                  key={status}
                >
                  <div className="step-indicator">
                    {current && !completed ? <i className="dot-pulse" /> : index + 1}
                  </div>
                  <div className="step-body">
                    <strong>
                      {status === "enviada"
                        ? "Solicitação enviada"
                        : status === "em_analise"
                          ? "Em análise"
                          : status === "aguardando_documentacao"
                            ? "Devolvido para ajustes"
                            : status === "aprovada"
                              ? "Aprovado pelo financeiro"
                              : status === "agendada"
                                ? "Agendado"
                                : "Concluída"}
                    </strong>
                    <small>
                      {status === "aguardando_documentacao" && expense.review_note
                        ? expense.review_note
                        : status === "paga" && expense.status === "paga"
                          ? "Pagamento efetuado com comprovante"
                          : EXPENSE_TYPE_LABEL[expense.expense_type]}
                    </small>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      {modal ? (
        <div className="modal-layer">
          <button className="modal-overlay" onClick={() => setModal(null)} aria-label="Fechar modal" />
          <form className="action-modal premium-modal" onSubmit={confirm}>
            <header>
              <div
                className={`modal-icon ${modal === "reject" ? "red" : modal === "docs" || modal === "resubmit" ? "amber" : "emerald"}`}
              >
                {modal === "reject" ? <Ban size={20} /> : <CheckCircle2 size={20} />}
              </div>
              <div>
                <h3>{modalTitle(modal)}</h3>
                <p>{expense.title}</p>
              </div>
            </header>
            {(modal === "reject" || modal === "docs") && (
              <label>
                {modal === "docs"
                  ? "Motivo da devolução / Instruções para o solicitante"
                  : "Motivo da recusa"}{" "}
                <span>*</span>
                <textarea value={note} onChange={(event) => setNote(event.target.value)} required />
              </label>
            )}
            {modal === "schedule" ? (
              <label>
                Data de pagamento <span>*</span>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(event) => setScheduledDate(event.target.value)}
                  required
                />
              </label>
            ) : null}
            {modal === "pay" || modal === "resubmit" ? (
              <label
                className="payment-upload"
                onClick={() => fileRef.current?.click()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  hidden
                  onChange={(event) => setProof(event.target.files?.[0] || null)}
                />
                <Upload size={22} />
                <strong>
                  {proof?.name ||
                    (modal === "pay" ? "Anexar comprovante final" : "Anexar documento solicitado")}
                </strong>
                <span>
                  {modal === "pay"
                    ? "Arquivo oficial que será liberado para o solicitante"
                    : "Nota fiscal ou documento pedido pelo financeiro"}
                </span>
                <small>PDF ou imagem {modal === "pay" || !expense.receipt ? "• obrigatório" : ""}</small>
              </label>
            ) : null}
            {error ? <div className="form-error">{error}</div> : null}
            <footer>
              <button className="secondary-button" type="button" onClick={() => setModal(null)}>
                Cancelar
              </button>
              <button
                className={modal === "reject" ? "destructive-button" : "primary-button"}
                disabled={
                  busy ||
                  ((modal === "reject" || modal === "docs") && note.length < 10) ||
                  (modal === "pay" && !proof) ||
                  (modal === "resubmit" && !proof && !expense.receipt)
                }
              >
                {busy ? <span className="spinner" /> : confirmLabel(modal)}
              </button>
            </footer>
          </form>
        </div>
      ) : null}
    </div>
  );
}
