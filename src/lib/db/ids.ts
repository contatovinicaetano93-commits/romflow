import { randomBytes } from "crypto";

export function uid(prefix: string): string {
  return `${prefix}_${randomBytes(5).toString("hex")}`;
}

export function inviteToken(): string {
  return randomBytes(32).toString("base64url");
}
