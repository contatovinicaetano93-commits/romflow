import { finalizePasswordResetIssue, requestPasswordReset } from "@/lib/server/data";
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
    await assertRateLimit(clientKey(request, "forgot"), undefined, 20);
    await assertRateLimit(clientKey(request, `forgot:${body.email}`));
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
    }
    return jsonOk({ ok: true });
  } catch (caught) {
    const message = publicError(caught);
    return jsonError(message, message.startsWith("Muitas tentativas") ? 429 : 400);
  }
}
