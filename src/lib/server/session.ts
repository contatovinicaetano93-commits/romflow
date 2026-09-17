import { compare, hash } from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { jwtVerify, SignJWT } from "jose";
import { cookies, headers } from "next/headers";
import { SEED } from "@/lib/seed";
import type { User, UserStatus } from "@/lib/types";
import { getDb } from "@/lib/db";
import { categories, companies, userAreas, userCompanies, users } from "@/lib/db/schema";
import { defaultAreasForRole, parseAreas, parseRole } from "@/lib/workflow";

const COOKIE = "romflow_session";

type SessionPayload = {
  sub: string;
  sv: number;
};

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET is not set.");
  }
  return new TextEncoder().encode(secret);
}

export const MIN_PASSWORD_LENGTH = 8;

export function assertPassword(password: string): void {
  if (password.trim().length < MIN_PASSWORD_LENGTH) {
    throw new Error("A senha deve ter no mínimo 8 caracteres.");
  }
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 10);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return compare(password, passwordHash);
}

async function sessionCookieSecure(): Promise<boolean> {
  const forwarded = (await headers()).get("x-forwarded-proto");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim().toLowerCase() === "https";
  }
  return process.env.NODE_ENV === "production";
}

async function readSessionVersion(userId: string): Promise<number> {
  try {
    const [row] = await getDb()
      .select({ sessionVersion: users.sessionVersion })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return row?.sessionVersion ?? 1;
  } catch {
    return 1;
  }
}

export async function bumpSessionVersion(userId: string): Promise<number> {
  const next = (await readSessionVersion(userId)) + 1;
  try {
    await getDb().update(users).set({ sessionVersion: next }).where(eq(users.id, userId));
  } catch {
    // Column may not exist until ensureSeeded migrates the schema.
  }
  return next;
}

export async function createSession(userId: string, sessionVersion?: number): Promise<void> {
  const sv = sessionVersion ?? (await readSessionVersion(userId));
  const token = await new SignJWT({ sub: userId, sv } satisfies SessionPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey());
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: await sessionCookieSecure(),
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

async function readSession(): Promise<{ userId: string; sv: number } | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) {
    return null;
  }
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.sub !== "string") {
      return null;
    }
    return { userId: payload.sub, sv: typeof payload.sv === "number" ? payload.sv : 1 };
  } catch {
    return null;
  }
}

export async function loadUser(userId: string): Promise<User | null> {
  const db = getDb();
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!row) {
    return null;
  }
  const links = await db.select().from(userCompanies).where(eq(userCompanies.userId, userId));
  const areaLinks = await db.select().from(userAreas).where(eq(userAreas.userId, userId));
  const role = parseRole(row.role);
  const storedAreas = parseAreas(areaLinks.map((item) => item.area));
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role,
    status: row.status as UserStatus,
    companyIds: links.map((item) => item.companyId),
    areaIds: storedAreas.length ? storedAreas : defaultAreasForRole(role, role === "solicitante" ? ["financeiro"] : []),
    created: row.created,
  };
}

export async function getCurrentUser(): Promise<User | null> {
  const session = await readSession();
  if (!session) {
    return null;
  }
  const user = await loadUser(session.userId);
  if (!user || user.status !== "active") {
    return null;
  }
  if ((await readSessionVersion(user.id)) !== session.sv) {
    return null;
  }
  return user;
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Sessão expirada.");
  }
  return user;
}

export async function requireAdmin(): Promise<User> {
  return requireMaster();
}

export async function requireMaster(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "master") {
    throw new Error("Apenas o master pode fazer isso.");
  }
  return user;
}

export async function userCount(): Promise<number> {
  const rows = await getDb().select({ id: users.id }).from(users);
  return rows.length;
}

async function ensureSeedCompanies(): Promise<void> {
  const db = getDb();
  const existing = await db.select({ id: companies.id, slug: companies.slug }).from(companies);
  const presentIds = new Set(existing.map((row) => row.id));
  const presentSlugs = new Set(existing.map((row) => row.slug));
  const missing = SEED.companies.filter(
    (item) => !presentIds.has(item.id) && !presentSlugs.has(item.slug),
  );
  if (missing.length === 0) {
    return;
  }
  await db.insert(companies).values(
    missing.map((item) => ({
      id: item.id,
      name: item.name,
      legalName: item.legal_name,
      slug: item.slug,
      initials: item.initials,
      color: item.color,
      isActive: item.is_active,
    })),
  );
}

async function grantAllCompaniesToMasters(): Promise<void> {
  const db = getDb();
  const companyRows = await db.select({ id: companies.id }).from(companies);
  if (companyRows.length === 0) {
    return;
  }
  const userRows = await db.select({ id: users.id, role: users.role }).from(users);
  if (userRows.length === 0) {
    return;
  }
  const links = await db.select().from(userCompanies);
  const linkedUserIds = new Set(links.map((item) => item.userId));
  const owned = new Set(links.map((item) => `${item.userId}:${item.companyId}`));
  const next: Array<{ userId: string; companyId: string }> = [];
  for (const row of userRows) {
    let role: ReturnType<typeof parseRole>;
    try {
      role = parseRole(row.role);
    } catch {
      continue;
    }
    if (role !== "master") {
      continue;
    }
    if (linkedUserIds.has(row.id)) {
      continue;
    }
    for (const company of companyRows) {
      const key = `${row.id}:${company.id}`;
      if (owned.has(key)) {
        continue;
      }
      owned.add(key);
      next.push({ userId: row.id, companyId: company.id });
    }
  }
  if (next.length === 0) {
    return;
  }
  await db.insert(userCompanies).values(next);
}

export async function ensureSeeded(): Promise<void> {
  const db = getDb();
  await ensureSeedCompanies();

  const [categoryRow] = await db.select({ id: categories.id }).from(categories).limit(1);
  if (!categoryRow) {
    await db.insert(categories).values(
      SEED.categories.map((item) => ({
        id: item.id,
        name: item.name,
        color: item.color,
        isActive: item.is_active,
      })),
    );
  }

  try {
    await db.execute(sql`UPDATE users SET role = 'master' WHERE role = 'admin'`);
    await db.execute(sql`UPDATE users SET role = 'admin_financeiro' WHERE role = 'financeiro'`);
    await db.execute(sql`UPDATE invitations SET role = 'master' WHERE role = 'admin'`);
    await db.execute(sql`UPDATE invitations SET role = 'admin_financeiro' WHERE role = 'financeiro'`);
    await db.execute(sql`UPDATE expenses SET area = 'financeiro' WHERE area IS NULL OR area = ''`);
    await db.execute(sql`UPDATE expenses SET status = 'em_analise' WHERE status = 'enviada'`);
    await db.execute(sql`UPDATE expenses SET status = 'devolvido' WHERE status = 'aguardando_documentacao'`);
    await db.execute(sql`UPDATE expenses SET status = 'aprovada' WHERE status IN ('agendada', 'paga')`);
    await db.execute(sql`UPDATE expenses SET expense_type = 'reembolso_colaborador' WHERE expense_type = 'reembolso'`);
    await db.execute(sql`UPDATE expenses SET expense_type = 'outros' WHERE expense_type IN ('adiantamento', 'impostos')`);
    await db.execute(sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS event_date text NOT NULL DEFAULT ''`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 1`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS password_resets (
        id text PRIMARY KEY,
        user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash text NOT NULL UNIQUE,
        expires text NOT NULL,
        used boolean NOT NULL DEFAULT false,
        created text NOT NULL
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS rate_limits (
        key text PRIMARY KEY,
        count integer NOT NULL,
        reset_at text NOT NULL
      )
    `);
  } catch {
    // Columns may not exist until drizzle push; next request after schema sync will migrate.
  }

  await grantAllCompaniesToMasters();
}

