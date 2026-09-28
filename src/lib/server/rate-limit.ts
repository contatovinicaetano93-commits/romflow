import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function prune(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function clientKey(request: Request, extra: string): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "unknown";
  return `${ip}:${extra.trim().toLowerCase()}`;
}

function assertMemoryLimit(key: string, label: string, max = MAX_ATTEMPTS): void {
  const now = Date.now();
  prune(now);
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  current.count += 1;
  if (current.count > max) {
    throw new Error(label);
  }
}

function countFromExecute(result: unknown): number {
  if (Array.isArray(result)) {
    const row = result[0] as { count?: number } | undefined;
    return Number(row?.count ?? 1);
  }
  if (result && typeof result === "object" && "rows" in result) {
    const rows = (result as { rows: Array<{ count?: number }> }).rows;
    return Number(rows[0]?.count ?? 1);
  }
  return 1;
}

export async function assertRateLimit(
  key: string,
  options: { label?: string; max?: number } = {},
): Promise<void> {
  const label = options.label ?? "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
  const max = options.max ?? MAX_ATTEMPTS;
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const resetAt = new Date(now + WINDOW_MS).toISOString();
  try {
    const db = getDb();
    const result = await db.execute(sql`
      INSERT INTO rate_limits (key, count, reset_at)
      VALUES (${key}, 1, ${resetAt})
      ON CONFLICT (key) DO UPDATE
      SET
        count = CASE
          WHEN rate_limits.reset_at <= ${nowIso} THEN 1
          ELSE rate_limits.count + 1
        END,
        reset_at = CASE
          WHEN rate_limits.reset_at <= ${nowIso} THEN ${resetAt}
          ELSE rate_limits.reset_at
        END
      RETURNING count
    `);
    if (countFromExecute(result) > max) {
      throw new Error(label);
    }
  } catch (caught) {
    if (caught instanceof Error && caught.message === label) {
      throw caught;
    }
    assertMemoryLimit(key, label, max);
  }
}

export async function assertRequestLimit(request: Request, action: string, detail?: string, ipMax = 20): Promise<void> {
  await assertRateLimit(clientKey(request, action), { max: ipMax });
  if (detail) {
    await assertRateLimit(clientKey(request, `${action}:${detail}`));
  }
}
