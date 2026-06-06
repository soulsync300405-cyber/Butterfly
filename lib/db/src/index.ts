import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

export let pool: any = null;
export let db: any = null;

if (process.env.DATABASE_URL) {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle(pool, { schema });
} else {
  console.warn("⚠️ DATABASE_URL is not set. Database features are running in Mock mode.");
  const dummyQuery = () => {
    const queryObj: any = {
      from: () => queryObj,
      where: () => queryObj,
      orderBy: () => queryObj,
      limit: () => queryObj,
      values: () => queryObj,
      onConflictDoUpdate: () => queryObj,
      onConflictDoNothing: () => queryObj,
      then: (resolve: any) => resolve([]),
    };
    return queryObj;
  };

  db = {
    select: () => dummyQuery(),
    insert: () => dummyQuery(),
    update: () => dummyQuery(),
    delete: () => dummyQuery(),
  };
}

export * from "./schema";
