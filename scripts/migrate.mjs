// Applies src/lib/schema.sql to whatever DATABASE_URL points at.
//   npm run migrate
// Everything in the schema is `if not exists`, so re-running is safe.
import postgres from "postgres";
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.error("No DATABASE_URL. Set one in .env.local or the environment.");
  process.exit(1);
}

// Show where we are going without ever printing the password.
const host = url.replace(/^[a-z+]+:\/\/[^@]*@/i, "").split("/")[0];
console.log(`applying schema to ${host}`);

const sql = postgres(url, { max: 1, prepare: false, ssl: host.includes("localhost") ? false : "require" });

try {
  await sql.unsafe(readFileSync("src/lib/schema.sql", "utf8"));
  const [{ count }] = await sql`select count(*)::int as count from runs`;
  const cols = await sql`
    select column_name, data_type from information_schema.columns
     where table_name = 'runs' order by ordinal_position`;
  console.log("ok. runs table present, holding", count, "row(s)");
  console.log(cols.map((c) => `  ${c.column_name} ${c.data_type}`).join("\n"));
} catch (err) {
  console.error("migration failed:", err.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
