// Verifies a Microsoft Entra ID token issued to the Papa's Memories SPA (Siva / Smitha sign-ins).
import { b64urlToBytes, b64urlJson } from "./access.js";
let jwks = { keys: null, at: 0 };

async function keys(env, force) {
  if (!force && jwks.keys && Date.now() - jwks.at < 3600_000) return jwks.keys;
  const url = env.MS_JWKS_URL || `https://login.microsoftonline.com/${env.TENANT_ID}/discovery/v2.0/keys`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("jwks");
  jwks = { keys: (await r.json()).keys || [], at: Date.now() };
  return jwks.keys;
}

/** Returns { email } for a valid ID token from our tenant and our SPA, else null. */
export async function verifyMsIdToken(token, env) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;
  let h, p;
  try { h = b64urlJson(parts[0]); p = b64urlJson(parts[1]); } catch { return null; }
  if (h.alg !== "RS256") return null;
  let k = (await keys(env)).find(x => x.kid === h.kid);
  if (!k) k = (await keys(env, true)).find(x => x.kid === h.kid);
  if (!k) return null;
  const key = await crypto.subtle.importKey("jwk", { kty: "RSA", n: k.n, e: k.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlToBytes(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1]));
  if (!ok) return null;
  const now = Math.floor(Date.now() / 1000);
  if (p.aud !== env.SPA_CLIENT_ID) return null;
  if (p.tid !== env.TENANT_ID) return null;
  if (p.iss !== `${env.MS_ISSUER_BASE || "https://login.microsoftonline.com"}/${env.TENANT_ID}/v2.0`) return null;
  if (typeof p.exp !== "number" || p.exp < now - 60) return null;
  const email = String(p.preferred_username || p.email || "").toLowerCase();
  return email ? { email } : null;
}
