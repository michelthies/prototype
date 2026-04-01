import { Pool } from "pg";

let pool: Pool | null = null;

export function getPgPool(
  connectionString: string,
  max = 20,
  idleTimeoutMillis = 30000,
  connectionTimeoutMillis = 5000,
): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString,
      max,
      idleTimeoutMillis,
      connectionTimeoutMillis,
    });
  }
  return pool;
}
