import { listNotificationRecipients } from "@/lib/server/data";
import { appUrl, deliverEmail, escapeHtml, romflowEmailHtml } from "@/lib/server/mail";
import { money, ROLE_LABEL, STATUS_LABEL } from "@/lib/format";
import type { Expense, FinanceAction, User } from "@/lib/types";
import { assertNever } from "@/lib/types";

function eventCopy(action: "created" | FinanceAction): { subject: string; headline: string } {
  switch (action) {
    case "created":
      return {
        subject: "Nova solicitação",
        headline: "Uma solicitação de pagamento foi registrada no ROM Flow.",
      };
    case "review":
      return {
        subject: "Solicitação em análise",
        headline: "A solicitação entrou em análise pelo financeiro.",
      };
    case "docs":
      return {
        subject: "Documentos solicitados",
        headline: "O financeiro pediu documentos complementares.",
      };
    case "approve":
      return {
        subject: "Solicitação aprovada",
        headline: "A solicitação foi aprovada.",
      };
    case "schedule":
      return {
        subject: "Pagamento agendado",
        headline: "O pagamento foi agendado.",
      };
    case "pay":
      return {
        subject: "Pagamento concluído",
        headline: "O pagamento foi marcado como pago.",
      };
    case "reject":
      return {
        subject: "Solicitação recusada",
        headline: "A solicitação foi recusada.",
      };
    case "resubmit":
      return {
        subject: "Solicitação reenviada",
        headline: "O solicitante reenviou a solicitação com os documentos.",
      };
    default:
      return assertNever(action);
  }
}

export async function notifyExpenseChange(input: {
  expense: Expense;
  companyName: string;
  actor: User;
  action: "created" | FinanceAction;
}): Promise<void> {
  const copy = eventCopy(input.action);
  const recipients = await listNotificationRecipients(input.expense.company, input.expense.requester);
  const note = input.expense.review_note.trim();
  const href = appUrl();
  const company = escapeHtml(input.companyName);
  const title = escapeHtml(input.expense.title);
  const actorName = escapeHtml(input.actor.name);
  const amount = escapeHtml(money(input.expense.amount));
  const status = escapeHtml(STATUS_LABEL[input.expense.status]);
  const safeNote = note ? escapeHtml(note) : "";
  await Promise.all(
    recipients.map((recipient) => {
      const roleLabel = ROLE_LABEL[recipient.role];
      const greeting = `Olá, ${recipient.name}. Você recebe este e-mail como ${roleLabel}.`;
      const body = [
        `<strong>${escapeHtml(copy.headline)}</strong>`,
        `Empresa: <strong>${company}</strong>`,
        `Solicitação: <strong>${title}</strong>`,
        `Valor: <strong>${amount}</strong>`,
        `Status: <strong>${status}</strong>`,
        `Movimentado por: <strong>${actorName}</strong>`,
        safeNote ? `Observação: ${safeNote}` : "",
      ].filter(Boolean);
      const text = [
        greeting,
        copy.headline,
        `Empresa: ${input.companyName}`,
        `Solicitação: ${input.expense.title}`,
        `Valor: ${money(input.expense.amount)}`,
        `Status: ${STATUS_LABEL[input.expense.status]}`,
        `Movimentado por: ${input.actor.name}`,
        note ? `Observação: ${note}` : "",
        href,
      ]
        .filter(Boolean)
        .join("\n");
      return deliverEmail({
        kind: input.action === "created" ? "expense_created" : "expense_status",
        toEmail: recipient.email,
        toName: recipient.name,
        toRole: recipient.role,
        expenseId: input.expense.id,
        subject: `${copy.subject} · ${input.companyName} · ${input.expense.title}`,
        text,
        html: romflowEmailHtml({
          title: copy.subject,
          greeting,
          body,
          ctaLabel: "Abrir o ROM Flow",
          ctaHref: href,
        }),
      });
    }),
  );
}
