import { compare, hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { SEED } from "@/lib/seed";
import type { Role, User, UserStatus } from "@/lib/types";
import { getDb } from "@/lib/db";
import { uid } from "@/lib/db/ids";
import { categories, companies, userCompanies, users } from "@/lib/db/schema";

const COOKIE = "romflow_session";

type SessionPayload = {
  sub: string;
};

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET is not set.");
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 10);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return compare(password, passwordHash);
}

export async function createSession(userId: string): Promise<void> {
  const token = await new SignJWT({ sub: userId } satisfies SessionPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey());
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

async function readSessionUserId(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) {
    return null;
  }
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return typeof payload.sub === "string" ? payload.sub : null;
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
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as Role,
    status: row.status as UserStatus,
    companyIds: links.map((item) => item.companyId),
    created: row.created,
  };
}

export async function getCurrentUser(): Promise<User | null> {
  const userId = await readSessionUserId();
  if (!userId) {
    return null;
  }
  const user = await loadUser(userId);
  if (!user || user.status !== "active") {
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
  const user = await requireUser();
  if (user.role !== "admin") {
    throw new Error("Apenas o administrador pode fazer isso.");
  }
  return user;
}

export async function userCount(): Promise<number> {
  const rows = await getDb().select({ id: users.id }).from(users);
  return rows.length;
}

export async function ensureSeeded(): Promise<void> {
  const db = getDb();
  const [companyRow] = await db.select({ id: companies.id }).from(companies).limit(1);
  if (!companyRow) {
    await db.insert(companies).values(
      SEED.companies.map((item) => ({
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

  if ((await userCount()) > 0) {
    return;
  }
  const seedUser = SEED.users[0];
  if (!seedUser?.password) {
    return;
  }
  await db.insert(users).values({
    id: seedUser.id,
    name: seedUser.name,
    email: seedUser.email,
    passwordHash: await hashPassword(seedUser.password),
    role: seedUser.role,
    status: seedUser.status,
    created: seedUser.created,
  });
  if (seedUser.companyIds.length) {
    await db.insert(userCompanies).values(
      seedUser.companyIds.map((companyId) => ({
        userId: seedUser.id,
        companyId,
      })),
    );
  }
}

export function newUserId(): string {
  return uid("usr");
}
