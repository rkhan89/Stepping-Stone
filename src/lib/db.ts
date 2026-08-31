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

/**
 * DATABASE_URL if you set it by hand. POSTGRES_URL is what the Vercel
 * Marketplace Supabase and Neon integrations inject, and a missing variable
 * here fails silently as "not persisted", so accept both rather than let the
 * provisioning route decide whether saving works.
 */
function connectionString() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || null;
}

/** Set once a connection string has proved unparseable, so we stop retrying. */
let broken = false;

/**
 * Percent-encode the password in a connection string.
 *
 * Supabase generates passwords containing characters that are not legal in a
 * URL, and pasting one in verbatim throws before a connection is ever tried.
 * Encoding cannot send the credentials somewhere else: the host, port and
 * database are untouched, so the worst case is the same auth failure you would
 * have had. Only attempted after the string has already failed to parse.
 */
function repairPassword(url: string): string | null {
  const scheme = url.match(/^([a-z+]+:\/\/)/i)?.[1];
  if (!scheme) return null;

  const rest = url.slice(scheme.length);
  // The password may itself contain '@', so the authority ends at the LAST one.
  const at = rest.lastIndexOf("@");
  if (at === -1) return null;

  const creds = rest.slice(0, at);
  const hostAndPath = rest.slice(at + 1);

  const colon = creds.indexOf(":");
  if (colon === -1) return null;

  const user = creds.slice(0, colon);
  const password = creds.slice(colon + 1);
  if (!password) return null;

  // Decode first where it is safe to, so an already-encoded password does not
  // get double-encoded into something wrong.
  let raw = password;
  try {
    raw = decodeURIComponent(password);
  } catch {
    // Not valid encoding, so treat it as literal text. This is the % case.
  }

  return `${scheme}${user}:${encodeURIComponent(raw)}@${hostAndPath}`;
}

/** Names the offending characters without ever logging the password. */
function describeBadChars(url: string): string {
  const found = new Set<string>();
  for (const ch of url) if ("%@#?&/:+ ".includes(ch)) found.add(ch);
  return [...found].join(" ");
}

/**
 * Supabase's direct host is IPv6-only and serverless functions are IPv4, so
 * this pairing fails as a DNS error that says nothing about the real cause.
 * The pooler is IPv4 and is what serverless should use anyway.
 */
function warnIfDirectSupabase(url: string) {
  if (!/db\.[a-z0-9]+\.supabase\.co/.test(url)) return;
  console.warn(
    "DATABASE_URL points at Supabase's direct host, which is IPv6-only and " +
      "unreachable from serverless functions. Use the Transaction pooler " +
      "string instead: host aws-0-<region>.pooler.supabase.com on port 6543, " +
      "and note the username changes from 'postgres' to 'postgres.<project-ref>'.",
  );
}

export function db() {
  if (broken) return null;
  const url = connectionString();
  if (!url) return null;
  warnIfDirectSupabase(url);

  const opts = {
    // Serverless: many short-lived instances, so keep each pool tiny.
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10,
    // pgbouncer in transaction mode cannot do prepared statements.
    prepare: false,
    ssl: sslFor(url),
  } as const;

  if (!sql) {
    try {
      sql = postgres(url, opts);
    } catch {
      // Almost always an unescaped character in the password. Try fixing that
      // before giving up, because the alternative is silently saving nothing.
      const repaired = repairPassword(url);
      if (repaired) {
        try {
          sql = postgres(repaired, opts);
          console.warn(
            "DATABASE_URL had an unescaped password and was encoded automatically. " +
              `Percent-encode these characters in the stored value: ${describeBadChars(url)}`,
          );
          return sql;
        } catch {
          // Fall through to the hard failure below.
        }
      }
      // A bad connection string should cost people their saved plan, not the
      // whole app.
      broken = true;
      console.error(
        "DATABASE_URL could not be parsed even after escaping the password, so " +
          "nothing will be saved. Check the host and port are intact and that " +
          "[YOUR-PASSWORD] was actually replaced.",
      );
      return null;
    }
  }
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
