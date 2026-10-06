import { connect } from "@tidbcloud/serverless";

/** TiDB (MySQL) over HTTP — works on the edge runtime. Server-only. */
export function db() {
  const url = process.env["DATABASE_URL"];
  if (!url) throw new Error("DATABASE_URL is not configured");
  return connect({ url, database: "badminton" });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function q<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db().execute(sql, params)) as T[];
}

export async function exec(sql: string, params: unknown[] = []): Promise<number> {
  const r = (await db().execute(sql, params, { fullResult: true })) as { rowsAffected?: number | null };
  return Number(r.rowsAffected ?? 0);
}

export const uid = () => crypto.randomUUID();
