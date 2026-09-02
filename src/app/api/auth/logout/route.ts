import { clearSession } from "@/lib/server/session";
import { jsonOk } from "@/lib/server/http";

export async function POST() {
  await clearSession();
  return jsonOk({ ok: true });
}
