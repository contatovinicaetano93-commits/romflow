import { canAccessCompany } from "@/lib/access";
import {
  SNAPSHOT_UNAVAILABLE,
  getBootstrapSnapshot,
  getCompanyWorkset,
  getOpsSnapshot,
  getSnapshot,
} from "@/lib/server/data";
import { ensureSeeded, requireUser } from "@/lib/server/session";
import { errorStatus, jsonError, jsonOk, publicError } from "@/lib/server/http";

export const dynamic = "force-dynamic";

type DataScope = "bootstrap" | "company" | "ops" | "full";

function parseScope(raw: string | null, companyId: string | null): DataScope {
  switch (raw) {
    case "bootstrap":
    case "company":
    case "ops":
    case "full":
      return raw;
    case null:
    case "":
      return companyId ? "company" : "bootstrap";
    default:
      throw new Error("Escopo inválido.");
  }
}

export async function GET(request: Request) {
  try {
    await ensureSeeded();
    const user = await requireUser();
    const url = new URL(request.url);
    const companyId = url.searchParams.get("companyId");
    const scope = parseScope(url.searchParams.get("scope"), companyId);
    switch (scope) {
      case "bootstrap": {
        try {
          return jsonOk(await getBootstrapSnapshot(user), 200, {
            "Cache-Control": "no-store, max-age=0",
          });
        } catch {
          return jsonError(SNAPSHOT_UNAVAILABLE, 503);
        }
      }
      case "company": {
        if (!companyId) {
          return jsonError("Empresa não informada.");
        }
        if (!canAccessCompany(user, companyId)) {
          return jsonError("Você não tem acesso a esta empresa.");
        }
        const workset = await getCompanyWorkset(user, companyId);
        return jsonOk(workset, 200, { "Cache-Control": "no-store, max-age=0" });
      }
      case "ops":
        return jsonOk(await getOpsSnapshot(user), 200, { "Cache-Control": "no-store, max-age=0" });
      case "full": {
        try {
          return jsonOk(await getSnapshot(user), 200, {
            "Cache-Control": "no-store, max-age=0",
          });
        } catch {
          return jsonError(SNAPSHOT_UNAVAILABLE, 503);
        }
      }
      default: {
        const exhaustive: never = scope;
        throw new Error(`Escopo não suportado: ${exhaustive}`);
      }
    }
  } catch (caught) {
    const message = publicError(caught);
    return jsonError(message, message === "Sessão expirada." ? 401 : errorStatus(message));
  }
}
