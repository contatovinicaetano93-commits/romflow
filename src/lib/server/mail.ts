import { Resend } from "resend";
import { getDb } from "@/lib/db";
import { uid } from "@/lib/db/ids";
import { emailLogs } from "@/lib/db/schema";
import { ROLE_LABEL } from "@/lib/format";
import type { EmailLogKind, Invitation, Role } from "@/lib/types";

export function appUrl(): string {
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

export function inviteUrl(token: string): string {
  return `${appUrl()}/convite?token=${token}`;
}

export function fromAddress(): string {
  const configured = process.env.RESEND_FROM?.trim() ?? "";
  if (configured && !configured.includes("onboarding@resend.dev")) {
    return configured;
  }
  return "ROM Flow <noreply@romconcept.com.br>";
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function romflowEmailHtml(input: {
  title: string;
  greeting: string;
  body: string[];
  ctaLabel: string;
  ctaHref: string;
}): string {
  const lines = input.body
    .map((line) => `<p style="margin:0 0 10px;color:#d4d4d8;font-size:14px;line-height:1.55">${line}</p>`)
    .join("");
  return `
    <div style="background:#0a0a0b;padding:28px 16px;font-family:Inter,Arial,sans-serif">
      <div style="max-width:560px;margin:0 auto;background:#161618;border:1px solid #27272a;border-radius:16px;padding:28px">
        <p style="margin:0 0 18px;color:#10b981;font-size:12px;letter-spacing:.12em;font-weight:700">ROM FLOW</p>
        <h1 style="margin:0 0 12px;color:#fafafa;font-size:22px;line-height:1.3">${escapeHtml(input.title)}</h1>
        <p style="margin:0 0 16px;color:#a1a1aa;font-size:14px">${escapeHtml(input.greeting)}</p>
        ${lines}
        <p style="margin:22px 0 0">
          <a href="${escapeHtml(input.ctaHref)}" style="display:inline-block;background:#10b981;color:#052e16;text-decoration:none;font-weight:700;border-radius:10px;padding:12px 16px">${escapeHtml(input.ctaLabel)}</a>
        </p>
        <p style="margin:18px 0 0;color:#71717a;font-size:12px">Se o botão não abrir, copie: ${escapeHtml(input.ctaHref)}</p>
      </div>
    </div>
  `;
}

export async function deliverEmail(input: {
  kind: EmailLogKind;
  toEmail: string;
  toName: string;
  toRole: Role | null;
  subject: string;
  text: string;
  html: string;
  expenseId?: string | null;
  invitationId?: string | null;
}): Promise<{ sent: boolean; error?: string; resendId?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = fromAddress();
  let sent = false;
  let error = "";
  let resendId: string | undefined;
  if (!apiKey) {
    error = "RESEND_API_KEY não configurada.";
  } else {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from,
      to: input.toEmail,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    if (result.error) {
      error = result.error.message;
    } else {
      sent = true;
      const id = result.data && "id" in result.data ? result.data.id : undefined;
      resendId = typeof id === "string" ? id : undefined;
    }
  }
  try {
    await getDb()
      .insert(emailLogs)
      .values({
        id: uid("eml"),
        kind: input.kind,
        expenseId: input.expenseId ?? null,
        invitationId: input.invitationId ?? null,
        toEmail: input.toEmail,
        toName: input.toName,
        toRole: input.toRole,
        subject: input.subject,
        status: sent ? "sent" : "failed",
        error,
        resendId: resendId ?? null,
        created: new Date().toISOString(),
      });
  } catch (caught) {
    const logError = caught instanceof Error ? caught.message : "Não foi possível registrar o envio.";
    error = error ? `${error} | ${logError}` : logError;
  }
  return { sent, error: sent ? undefined : error, resendId };
}

export async function sendInviteEmail(
  invitation: Invitation,
  invitedByName: string,
): Promise<{ sent: boolean; error?: string }> {
  const link = inviteUrl(invitation.token);
  const roleLabel = ROLE_LABEL[invitation.role];
  const result = await deliverEmail({
    kind: "invite",
    toEmail: invitation.email,
    toName: invitation.email,
    toRole: invitation.role,
    invitationId: invitation.id,
    subject: "Convite para o ROM Flow",
    text: `${invitedByName} convidou você para o ROM Flow como ${roleLabel}.\n\nAtive seu acesso: ${link}\n\nO convite expira em 30 dias.`,
    html: romflowEmailHtml({
      title: "Você foi convidado para o ROM Flow",
      greeting: `Olá, ${invitedByName} criou seu acesso.`,
      body: [
        `Perfil: <strong>${roleLabel}</strong>`,
        "Defina sua senha para entrar no fluxo de solicitações, aprovações e pagamentos.",
        "Este convite expira em 30 dias.",
      ],
      ctaLabel: "Ativar meu acesso",
      ctaHref: link,
    }),
  });
  return { sent: result.sent, error: result.error };
}
