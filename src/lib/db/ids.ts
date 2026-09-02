import { randomBytes } from "crypto";

export function uid(prefix: string): string {
  return `${prefix}_${randomBytes(5).toString("hex")}`;
}
