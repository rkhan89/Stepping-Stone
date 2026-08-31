import postgres from "postgres";
import type { Run } from "./session";

/**
 * Any Postgres. DATABASE_URL points at Supabase today; nothing here is
 * specific to it. Pooled connections keep prepared statements off, because
 * pgbouncer in transaction mode does not support them.
 */
let sql: postgres.Sql | null = null;

/**
 * Hosted Postgres wants TLS; a local one usually cannot do it at all, and
 * offering it produces a connect timeout rather than a useful error. An
 * explicit sslmode in the URL always wins.
 */
function sslFor(url: string): false | "require" {
  try {
    const u = new URL(url);
    const mode = u.searchParams.get("sslmode");
    if (mode === "disable") return false;
    if (mode) return "require";
    const host = u.hostname.replace(/^\[|\]$/g, "");
    return ["localhost", "127.0.0.1", "::1"].includes(host) ? false : "require";
  } catch {
    return "require";
  }
}

export function db() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  sql ??= postgres(url, {
    // Serverless: many short-lived instances, so keep each one's pool tiny.
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10,
    // pgbouncer in transaction mode cannot do prepared statements.
    prepare: false,
    ssl: sslFor(url),
  });
  return sql;
}

export type StoredRun = {
  id: string;
  goal: string;
  state: Run;
  updatedAt: string;
};

/** The newest run belonging to this browser, or null. */
export async function loadRun(ownerId: string): Promise<StoredRun | null> {
  const s = db();
  if (!s) return null;
  const rows = await s<
    { id: string; goal: string; state: Run; updated_at: Date }[]
  >`
    select id, goal, state, updated_at
      from runs
     where owner_id = ${ownerId}
     order by updated_at desc
     limit 1
  `;
  const r = rows[0];
  return r
    ? { id: r.id, goal: r.goal, state: r.state, updatedAt: r.updated_at.toISOString() }
    : null;
}

/**
 * Upsert. The client sends the run id it already has; without one we start a
 * new row. Scoped by owner_id in the where clause so a guessed id is useless.
 */
export async function saveRun(
  ownerId: string,
  runId: string | null,
  goal: string,
  state: Run,
): Promise<string | null> {
  const s = db();
  if (!s) return null;

  if (runId) {
    const rows = await s<{ id: string }[]>`
      update runs
         set state = ${s.json(state as never)},
             goal = ${goal},
             updated_at = now()
       where id = ${runId} and owner_id = ${ownerId}
      returning id
    `;
    if (rows[0]) return rows[0].id;
    // Fell through: the row is gone, or belongs to someone else. Start fresh
    // rather than silently writing nothing.
  }

  const rows = await s<{ id: string }[]>`
    insert into runs (owner_id, goal, state)
    values (${ownerId}, ${goal}, ${s.json(state as never)})
    returning id
  `;
  return rows[0]?.id ?? null;
}

/**
 * Delete, for real. The design promises "Cancel and it's deleted", so this is
 * a hard delete and not a flag.
 */
export async function deleteRuns(ownerId: string): Promise<number> {
  const s = db();
  if (!s) return 0;
  const rows = await s<{ id: string }[]>`
    delete from runs where owner_id = ${ownerId} returning id
  `;
  return rows.length;
}
