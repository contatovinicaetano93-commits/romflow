import { createInvitationRecord, updateInvitationAccessRecord } from "@/lib/server/data";
import { sendInviteEmail } from "@/lib/server/mail";
import { ensureSeeded, requireAdmin } from "@/lib/server/session";
import { jsonError, jsonOk, publicError, readJson } from "@/lib/server/http";
import type { Role } from "@/lib/types";

export async function POST(request: Request) {
  try {
    await ensureSeeded();
    const user = await requireAdmin();
    const body = await readJson<{ email?: string; role?: Role; companyIds?: string[] }>(request);
    if (!body.email || !body.role) {
      return jsonError("Informe e-mail e perfil.");
    }
    const invitation = await createInvitationRecord(user, body.email, body.role, body.companyIds ?? []);
    const mail = await sendInviteEmail(invitation, user.name);
    return jsonOk({ invitation, emailSent: mail.sent, emailError: mail.error });
  } catch (caught) {
    const message = publicError(caught);
    return jsonError(message, message === "Sessão expirada." ? 401 : 400);
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureSeeded();
    await requireAdmin();
    const body = await readJson<{ invitationId?: string; role?: Role; companyIds?: string[] }>(request);
    if (!body.invitationId || !body.role) {
      return jsonError("Informe o convite e o perfil.");
    }
    const invitation = await updateInvitationAccessRecord(
      body.invitationId,
      body.role,
      body.companyIds ?? [],
    );
    return jsonOk({ invitation });
  } catch (caught) {
    const message = publicError(caught);
    return jsonError(message, message === "Sessão expirada." ? 401 : 400);
  }
}
