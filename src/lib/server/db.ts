import { connect } from "@tidbcloud/serverless";

/** TiDB (MySQL) over HTTP — works on the edge runtime. Server-only. */
export function db() {
  const url = process.env["DATABASE_URL"];
  if (!url) throw new Error("DATABASE_URL is not configured");
  return connect({ url, database: process.env["DB_NAME"] || "badminton" });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function q<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db().execute(sql, params)) as T[];
}

export async function exec(sql: string, params: unknown[] = []): Promise<number> {
  const r = (await db().execute(sql, params, { fullResult: true })) as { rowsAffected?: number | null };
  return Number(r.rowsAffected ?? 0);
}

export type Stmt = [sql: string, params: unknown[]];

/** Runs statements atomically: all commit or none do (TiDB serverless transaction). */
export async function transaction(stmts: Stmt[]): Promise<void> {
  const tx = await db().begin();
  try {
    for (const [sql, params] of stmts) await tx.execute(sql, params);
    await tx.commit();
  } catch (e) {
    await tx.rollback().catch(() => {});
    throw e;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Tx = { execute: (sql: string, params?: unknown[]) => Promise<any> };

/** Interactive transaction: reads and writes inside `fn` commit together or roll back together. */
export async function withTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const tx = await db().begin();
  try {
    const out = await fn(tx as unknown as Tx);
    await tx.commit();
    return out;
  } catch (e) {
    await tx.rollback().catch(() => {});
    throw e;
  }
}

export const uid = () => crypto.randomUUID();
