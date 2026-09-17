import { createHash, randomBytes } from "crypto";

export function uid(prefix: string): string {
  return `${prefix}_${randomBytes(5).toString("hex")}`;
}

export function inviteToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
