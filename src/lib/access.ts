import type { User } from "./types";

export function canAccessCompany(user: User, companyId: string): boolean {
  return user.companyIds.includes(companyId);
}
