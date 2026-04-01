import { Client } from "pg";

export function getPgClient(pgConnectionString: string): Client {
  const pgClient = new Client({
    connectionString: pgConnectionString,
  });
  return pgClient;
}
