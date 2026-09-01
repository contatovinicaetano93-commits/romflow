import { Resend } from "resend";
import { ROLE_LABEL } from "@/lib/format";
import type { Invitation } from "@/lib/types";

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

export async function sendInviteEmail(
  invitation: Invitation,
  invitedByName: string,
): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) {
    return { sent: false, error: "RESEND_API_KEY ou RESEND_FROM não configurados." };
  }
  const link = inviteUrl(invitation.token);
  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from,
    to: invitation.email,
    subject: "Convite para o ROM Flow",
    text: `${invitedByName} convidou você para o ROM Flow como ${ROLE_LABEL[invitation.role]}.\n\nAtive seu acesso: ${link}\n\nO convite expira em 30 dias.`,
    html: `
      <p><strong>${invitedByName}</strong> convidou você para o ROM Flow.</p>
      <p>Perfil: <strong>${ROLE_LABEL[invitation.role]}</strong></p>
      <p><a href="${link}">Ativar meu acesso</a></p>
      <p style="color:#71717a;font-size:12px">Se o botão não abrir, copie: ${link}</p>
      <p style="color:#71717a;font-size:12px">Este convite expira em 30 dias.</p>
    `,
  });
  if (result.error) {
    return { sent: false, error: result.error.message };
  }
  return { sent: true };
}
