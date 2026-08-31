import { cookies } from "next/headers";

const COOKIE = "ss_owner";
const A_YEAR = 60 * 60 * 24 * 365;

/**
 * Who this browser is, with no account attached. httpOnly so page scripts
 * cannot read or forge it, which is what makes it safe to scope every query
 * by. At registration this id gets attached to a real user rather than
 * replaced, so nobody loses a plan by signing up.
 */
export async function getOwnerId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(COOKIE)?.value;
  if (existing) return existing;

  const id = crypto.randomUUID();
  jar.set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: A_YEAR,
  });
  return id;
}

/** Read without minting one. For routes that should not create an identity. */
export async function peekOwnerId(): Promise<string | null> {
  return (await cookies()).get(COOKIE)?.value ?? null;
}

export async function clearOwnerId(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
