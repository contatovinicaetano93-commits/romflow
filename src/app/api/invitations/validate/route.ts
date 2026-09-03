import { getInvitationByToken, listCompaniesByIds } from "@/lib/server/data";
import { ensureSeeded } from "@/lib/server/session";
import { jsonError, jsonOk, publicError } from "@/lib/server/http";
import { assertRateLimit, clientKey } from "@/lib/server/rate-limit";

export async function GET(request: Request) {
  try {
    await ensureSeeded();
    const token = new URL(request.url).searchParams.get("token") ?? "";
    if (!token) {
      return jsonError("Token de convite não encontrado na URL. Verifique o link recebido.");
    }
    assertRateLimit(clientKey(request, `invite:${token.slice(0, 12)}`));
    const invitation = await getInvitationByToken(token);
    const companies = await listCompaniesByIds(invitation.companyIds);
    return jsonOk({ invitation, companies });
  } catch (caught) {
    return jsonError(publicError(caught), 400);
  }
}
