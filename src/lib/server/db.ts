import { connect } from "@tidbcloud/serverless";

/** TiDB (MySQL) over HTTP — works on the edge runtime. Server-only. */
export function db() {
  const url = process.env["DATABASE_URL"];
  if (!url) throw new Error("DATABASE_URL is not configured");
  return connect({ url, database: "badminton" });
}
