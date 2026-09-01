import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const sentryDsn =
  process.env.SENTRY_DSN ??
  process.env.NEXT_PUBLIC_SENTRY_DSN ??
  "https://87bdbc103efa97ec11e6f39327fd97cb@o4512013512540160.ingest.us.sentry.io/4512013519618048";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@neondatabase/serverless", "bcryptjs"],
  env: {
    SENTRY_DSN: sentryDsn,
    NEXT_PUBLIC_SENTRY_DSN: sentryDsn,
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  silent: !process.env.CI,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
