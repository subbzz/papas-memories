import { verifyMsIdToken } from "./msid.js";
// Verifies the Cloudflare Access JWT on each request (defence in depth: never trust the edge alone).
const enc = new TextEncoder();
let certCache = { keys: null, at: 0 };

export const b64urlToBytes = s => {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
};
export const b64urlJson = s => JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));

async function getKeys(env, force = false) {
  if (!force && certCache.keys && Date.now() - certCache.at < 3600_000) return certCache.keys;
  const url = env.ACCESS_CERTS_URL || `https://${env.TEAM_DOMAIN}/cdn-cgi/access/certs`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("Cannot load Access certs");
  certCache = { keys: (await r.json()).keys || [], at: Date.now() };
  return certCache.keys;
}

/** Returns { email } when the request carries a valid Access token for `aud`, else null. */
export async function verifyAccess(request, env, aud) {
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token || !aud || !env.TEAM_DOMAIN) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  let header, payload;
  try { header = b64urlJson(parts[0]); payload = b64urlJson(parts[1]); } catch { return null; }
  if (header.alg !== "RS256") return null;

  let keys = await getKeys(env);
  let jwk = keys.find(k => k.kid === header.kid);
  if (!jwk) { keys = await getKeys(env, true); jwk = keys.find(k => k.kid === header.kid); }
  if (!jwk) return null;

  const key = await crypto.subtle.importKey("jwk", { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlToBytes(parts[2]), enc.encode(parts[0] + "." + parts[1]));
  if (!ok) return null;

  const now = Math.floor(Date.now() / 1000);
  const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!auds.includes(aud)) return null;
  if (payload.iss !== `https://${env.TEAM_DOMAIN}`) return null;
  if (typeof payload.exp !== "number" || payload.exp < now - 30) return null;
  if (payload.nbf && payload.nbf > now + 30) return null;
  if (!payload.email) return null;
  return { email: String(payload.email).trim().toLowerCase() };
}

export const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra } });

export const deny = (status = 401) => json({ error: status === 403 ? "forbidden" : "unauthorised" }, status);

/** Owner-only guard for /api/admin/*: Cloudflare Access identity, or a verified Microsoft ID token (Bearer). */
export async function requireOwner(request, env) {
  const owner = String(env.OWNER_EMAIL || "").toLowerCase();
  if (!owner) return null;
  const viaAccess = await verifyAccess(request, env, env.ADMIN_AUD).catch(() => null);
  if (viaAccess && viaAccess.email === owner) return viaAccess;
  const auth = request.headers.get("Authorization") || "";
  if (/^Bearer\s+/i.test(auth)) {
    const viaMs = await verifyMsIdToken(auth.replace(/^Bearer\s+/i, ""), env).catch(() => null);
    if (viaMs && viaMs.email === owner) return viaMs;
  }
  return null;
}

/** Family guard: valid Access identity, and optionally an approved entry in KV. */
export async function familyUser(request, env) {
  const who = await verifyAccess(request, env, env.FAMILY_AUD);
  if (!who) return null;
  const rec = await env.FAMILY.get("u:" + who.email, "json");
  return { ...who, rec };
}
export const isApproved = u => u?.rec?.status === "approved";
