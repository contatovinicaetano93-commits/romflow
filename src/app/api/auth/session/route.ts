import { ensureSeeded, getCurrentUser, userCount } from "@/lib/server/session";
import { jsonOk, publicError } from "@/lib/server/http";

export async function GET() {
  try {
    await ensureSeeded();
    const user = await getCurrentUser();
    return jsonOk({
      user,
      needsSetup: (await userCount()) === 0,
    });
  } catch (caught) {
    return Response.json({ error: publicError(caught), user: null, needsSetup: false }, { status: 500 });
  }
}
