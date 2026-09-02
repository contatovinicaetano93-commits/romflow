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
        headline: "Uma solicitação foi registrada no ROM Flow.",
      };
    case "docs":
      return {
        subject: "Solicitação devolvida",
        headline: "A solicitação voltou para ajustes.",
      };
    case "approve":
      return {
        subject: "Solicitação aprovada",
        headline: "A solicitação foi aprovada.",
      };
    case "reject":
      return {
        subject: "Solicitação recusada",
        headline: "A solicitação foi recusada.",
      };
    case "resubmit":
      return {
        subject: "Solicitação reenviada",
        headline: "O solicitante reenviou a solicitação.",
      };
    case "attach_proof":
      return {
        subject: "Recibo de pagamento anexado",
        headline: "O recibo de pagamento foi anexado à solicitação.",
      };
    case "progress":
      return {
        subject: "Solicitação em andamento",
        headline: "A solicitação avançou para em andamento.",
      };
    case "complete":
      return {
        subject: "Solicitação finalizada",
        headline: "A solicitação foi finalizada.",
      };
    case "cancel":
      return {
        subject: "Solicitação cancelada",
        headline: "A solicitação foi cancelada.",
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
  const recipients = await listNotificationRecipients(
    input.expense.company,
    input.expense.requester,
    input.expense.area,
  );
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
