import { Pool, type PoolClient, type QueryResultRow } from "pg";

// Single shared connection pool, reused across hot reloads in dev.
const globalForDb = globalThis as unknown as { pgPool: Pool | undefined };

const connectionString = process.env.DATABASE_URL ?? "";

// Enable TLS for managed/remote Postgres (Neon, Supabase, RDS, …) but not for
// local connections. Hosted providers require SSL; local sockets/localhost don't.
const isLocal =
  connectionString.includes("localhost") ||
  connectionString.includes("127.0.0.1") ||
  connectionString.includes("host=/"); // unix socket
const needsSsl =
  !isLocal &&
  (connectionString.includes("sslmode=require") ||
    connectionString.includes("neon.tech") ||
    process.env.PGSSL === "true" ||
    process.env.NODE_ENV === "production");

export const pool =
  globalForDb.pgPool ??
  new Pool({
    connectionString,
    max: 10,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgPool = pool;
}

// Typed query helper.
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const res = await pool.query<T>(text, params as never[]);
  return res.rows;
}

// Run a function inside a transaction, with automatic COMMIT/ROLLBACK.
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ---- row types (snake_case columns) ----
export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  created_at: Date;
}

export interface NoteRow {
  id: string;
  title: string;
  content: string;
  author_id: string;
  created_at: Date;
  updated_at: Date;
}

export type ShareType = "ONE_TIME" | "TIME_BASED";
export type AccessType = "PUBLIC" | "PASSWORD_PROTECTED";

export interface ShareLinkRow {
  id: string;
  token: string;
  note_id: string;
  creator_id: string;
  share_type: ShareType;
  access_type: AccessType;
  password_hash: string | null;
  expires_at: Date | null;
  revoked: boolean;
  used_at: Date | null;
  view_count: number;
  failed_attempts: number;
  locked_until: Date | null;
  created_at: Date;
}
