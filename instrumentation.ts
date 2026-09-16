import * as Sentry from "@sentry/nextjs";
import { assertProductionConfig } from "@/lib/server/config";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    assertProductionConfig();
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
