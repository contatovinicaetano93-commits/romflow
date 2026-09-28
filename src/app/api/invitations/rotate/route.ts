import { rotateInvitationLink } from "@/lib/server/data";
import { sendInviteEmail } from "@/lib/server/mail";
import { ensureSeeded, requireAdmin } from "@/lib/server/session";
import { errorStatus, jsonError, jsonOk, publicError, readJson } from "@/lib/server/http";

export async function POST(request: Request) {
  try {
    await ensureSeeded();
    const user = await requireAdmin();
    const body = await readJson<{ invitationId?: string }>(request);
    if (!body.invitationId) {
      return jsonError("Informe o convite.");
    }
    const rotated = await rotateInvitationLink(user, body.invitationId);
    let mail: { sent: boolean; error?: string } = {
      sent: false,
      error: "Não foi possível enviar o e-mail.",
    };
    try {
      mail = await sendInviteEmail(rotated.invitation, user.name, rotated.plaintextToken);
    } catch (caught) {
      mail = {
        sent: false,
        error: publicError(caught, "Não foi possível enviar o e-mail."),
      };
    }
    return jsonOk({
      invitation: rotated.invitation,
      plaintextToken: rotated.plaintextToken,
      emailSent: mail.sent,
      emailError: mail.error,
    });
  } catch (caught) {
    const message = publicError(caught);
    return jsonError(message, errorStatus(message));
  }
}
