import { requestPasswordReset } from "@/lib/server/data";
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
      try {
        await sendPasswordResetEmail(reset.email, reset.name, reset.token);
      } catch {
        // Same response either way so the form does not leak whether the e-mail exists.
      }
    }
    return jsonOk({ ok: true });
  } catch (caught) {
    const message = publicError(caught);
    return jsonError(message, message.startsWith("Muitas tentativas") ? 429 : 400);
  }
}
