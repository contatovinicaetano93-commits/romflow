import { rotateInvitationLink } from "@/lib/server/data";
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
    return jsonOk({
      invitation: rotated.invitation,
      plaintextToken: rotated.plaintextToken,
    });
  } catch (caught) {
    const message = publicError(caught);
    return jsonError(message, errorStatus(message));
  }
}
