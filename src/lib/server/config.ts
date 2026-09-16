export function isVercelProduction(): boolean {
  return process.env.VERCEL_ENV === "production";
}

export function blobRequired(): boolean {
  return process.env.NODE_ENV === "production";
}

export function assertProductionConfig(): void {
  if (!isVercelProduction()) {
    return;
  }
  const missing: string[] = [];
  if (!process.env.APP_URL?.trim()) {
    missing.push("APP_URL");
  }
  if (!process.env.RESEND_API_KEY?.trim()) {
    missing.push("RESEND_API_KEY");
  }
  if (!process.env.ROMFLOWBLOB_STORE_ID && !process.env.BLOB_READ_WRITE_TOKEN) {
    missing.push("ROMFLOWBLOB_STORE_ID");
  }
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 16) {
    missing.push("SESSION_SECRET");
  }
  if (!process.env.DATABASE_URL) {
    missing.push("DATABASE_URL");
  }
  if (missing.length === 0) {
    return;
  }
  throw new Error(`Configuração incompleta para produção: ${missing.join(", ")}.`);
}
