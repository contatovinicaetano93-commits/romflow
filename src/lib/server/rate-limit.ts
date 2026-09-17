import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { rateLimits } from "@/lib/db/schema";

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

export async function assertRateLimit(
  key: string,
  options: { label?: string; max?: number } = {},
): Promise<void> {
  const label = options.label ?? "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
  const max = options.max ?? MAX_ATTEMPTS;
  const now = Date.now();
  const resetAt = new Date(now + WINDOW_MS).toISOString();
  try {
    const db = getDb();
    const [row] = await db.select().from(rateLimits).where(eq(rateLimits.key, key)).limit(1);
    if (!row || new Date(row.resetAt).getTime() <= now) {
      await db
        .insert(rateLimits)
        .values({ key, count: 1, resetAt })
        .onConflictDoUpdate({
          target: rateLimits.key,
          set: { count: 1, resetAt },
        });
      return;
    }
    const next = row.count + 1;
    if (next > max) {
      throw new Error(label);
    }
    await db.update(rateLimits).set({ count: next }).where(eq(rateLimits.key, key));
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
