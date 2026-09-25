export const TOMBSTONE_EMAIL_DOMAIN = "invalid.romflow";

export function isTombstoneEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${TOMBSTONE_EMAIL_DOMAIN}`);
}

export function tombstoneEmailFor(userId: string, at = Date.now()): string {
  const safeId = userId.replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase() || "user";
  return `deleted+${safeId}.${at}@${TOMBSTONE_EMAIL_DOMAIN}`;
}

export function isProtectedDirectoryUser(
  row: { id: string; name: string; email: string },
  actorId: string,
): boolean {
  if (row.id === actorId) {
    return true;
  }
  return /rodrigo/i.test(`${row.name} ${row.email}`);
}

export function visibleDirectoryUsers<T extends { email: string }>(users: T[]): T[] {
  return users.filter((item) => !isTombstoneEmail(item.email));
}
