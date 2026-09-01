import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as { romflowDb?: Db };

export function getDb(): Db {
  if (!globalForDb.romflowDb) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not set.");
    }
    globalForDb.romflowDb = drizzle(neon(url), { schema });
  }
  return globalForDb.romflowDb;
}
