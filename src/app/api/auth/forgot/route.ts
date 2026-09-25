import { finalizePasswordResetIssue, requestPasswordReset } from "@/lib/server/data";
import { sendPasswordResetEmail } from "@/lib/server/mail";
import { errorStatus, jsonError, jsonOk, publicError, readJson } from "@/lib/server/http";
import { assertRequestLimit } from "@/lib/server/rate-limit";
import { ensureSeeded } from "@/lib/server/session";

export async function POST(request: Request) {
  try {
    await ensureSeeded();
    const body = await readJson<{ email?: string }>(request);
    if (!body.email) {
      return jsonError("Informe o e-mail.");
    }
    await assertRequestLimit(request, "forgot", body.email);
    const reset = await requestPasswordReset(body.email);
    if (reset) {
      let delivered = false;
      try {
        const mail = await sendPasswordResetEmail(reset.email, reset.name, reset.token);
        delivered = mail.sent;
      } catch {
        delivered = false;
      }
      await finalizePasswordResetIssue({ id: reset.id, userId: reset.userId, delivered });
      if (!delivered) {
        return jsonError("Não foi possível enviar o e-mail agora. Tente de novo em alguns minutos.", 502);
      }
    }
    return jsonOk({ ok: true });
  } catch (caught) {
    const message = publicError(caught);
    return jsonError(message, errorStatus(message));
  }
}
