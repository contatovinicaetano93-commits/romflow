import { invalidateAndClearSession } from "@/lib/server/session";
import { jsonOk } from "@/lib/server/http";

export async function POST() {
  await invalidateAndClearSession();
  return jsonOk({ ok: true });
}
