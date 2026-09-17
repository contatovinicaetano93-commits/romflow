import {
  abandonPasswordReset,
  confirmPasswordResetEmail,
  requestPasswordReset,
} from "@/lib/server/data";
import { sendPasswordResetEmail } from "@/lib/server/mail";
import { jsonError, jsonOk, publicError, readJson } from "@/lib/server/http";
import { assertRateLimit, clientKey } from "@/lib/server/rate-limit";
import { ensureSeeded } from "@/lib/server/session";

export async function POST(request: Request) {
  try {
    await ensureSeeded();
    const body = await readJson<{ email?: string }>(request);
    if (!body.email) {
      return jsonError("Informe o e-mail.");
    }
    await assertRateLimit(clientKey(request, `forgot:${body.email}`));
    const reset = await requestPasswordReset(body.email);
    if (reset) {
      let mail: { sent: boolean; error?: string };
      try {
        mail = await sendPasswordResetEmail(reset.email, reset.name, reset.token);
      } catch (caught) {
        await abandonPasswordReset(reset.id);
        throw caught;
      }
      if (!mail.sent) {
        await abandonPasswordReset(reset.id);
        return jsonError(mail.error || "Não foi possível enviar o e-mail. Tente de novo.");
      }
      await confirmPasswordResetEmail(reset.userId, reset.id);
    }
    return jsonOk({ ok: true });
  } catch (caught) {
    const message = publicError(caught);
    return jsonError(message, message.startsWith("Muitas tentativas") ? 429 : 400);
  }
}
