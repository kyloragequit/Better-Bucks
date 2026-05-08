
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@workspace/db";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const isProduction = process.env.NODE_ENV === "production";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: isProduction ? 30 : 10,
  min: isProduction ? 4 : 1,
  idleTimeoutMillis: isProduction ? 30_000 : 15_000,
  connectionTimeoutMillis: isProduction ? 10_000 : 5_000,
  allowExitOnIdle: !isProduction,
  statement_timeout: 30_000,
  query_timeout: 30_000,
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle DB client:", err);
});

export const db = drizzle(pool, { schema });
