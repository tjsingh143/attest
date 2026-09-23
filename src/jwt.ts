/**
 * Attest — HS256 tokens for the local stack.
 *
 * Two probes need a real token rather than a `set_config` claims injection:
 * the Realtime websocket cases (F8i), which authenticate over the wire, and the
 * expired-session boundary, which is rejected by PostgREST before PostgreSQL
 * sees anything. Both are talking to a service that verifies a signature, so a
 * claims object is not enough.
 *
 * The secret is the local development stack's, read from the environment or
 * falling back to the Supabase CLI's documented default. It is a well-known
 * value for a throwaway instance, it is not a credential for anything, and the
 * harness only ever points at loopback. If the secret is ever changed on the
 * instance, set `ATTEST_JWT_SECRET` rather than editing this.
 */
import { createHmac } from "node:crypto";

export const JWT_SECRET =
  process.env.ATTEST_JWT_SECRET ?? "super-secret-jwt-token-with-at-least-32-characters-long";

const b64url = (b: Buffer | string): string =>
  Buffer.from(b).toString("base64").replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

/**
 * Sign a claim set.
 *
 * `exp` defaults to an hour out. Passing an `exp` in the past is how the
 * expired-session boundary is built, and that is deliberate rather than an
 * accident of the API: the probe needs a token that is well-formed and
 * correctly signed but stale, so that what rejects it is expiry and not a bad
 * signature.
 */
export async function signJwt(claims: Record<string, unknown>): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload = { iat: now, exp: now + 3600, ...claims };
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest();
  return `${header}.${body}.${b64url(sig)}`;
}
