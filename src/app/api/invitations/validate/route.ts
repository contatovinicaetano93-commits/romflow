import { getInvitationByToken } from "@/lib/server/data";
import { ensureSeeded } from "@/lib/server/session";
import { jsonError, jsonOk, publicError } from "@/lib/server/http";

export async function GET(request: Request) {
  try {
    await ensureSeeded();
    const token = new URL(request.url).searchParams.get("token") ?? "";
    if (!token) {
      return jsonError("Token de convite não encontrado na URL. Verifique o link recebido.");
    }
    const invitation = await getInvitationByToken(token);
    return jsonOk({ invitation });
  } catch (caught) {
    return jsonError(publicError(caught), 400);
  }
}
