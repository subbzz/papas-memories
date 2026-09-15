// Short-lived signed media tokens, so audio/video players that don't send cookies
// (iPhone/iPad browsers use Apple's media stack) can still stream.
// Every use is re-checked: family tokens against the approval list, Microsoft tokens against the allowed people.
import { b64urlToBytes } from "./access.js";

const enc = new TextEncoder();
const b64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function hmacKey(env) {
  const seed = env.MEDIA_TOKEN_SECRET || env.GRAPH_CLIENT_SECRET;
  if (!seed) throw new Error("no signing secret");
  const raw = await crypto.subtle.digest("SHA-256", enc.encode("papas-memories/media-token/v1:" + seed));
  return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

/** kind: "family" (Gmail + approval) or "ms" (Dada / Mama Microsoft sign-in). */
export async function mintToken(env, email, kind, ttlSec = 6 * 3600) {
  const payload = b64url(enc.encode(JSON.stringify({ e: email, k: kind, x: Math.floor(Date.now() / 1000) + ttlSec })));
  const sig = b64url(await crypto.subtle.sign("HMAC", await hmacKey(env), enc.encode(payload)));
  return `${payload}.${sig}`;
}

export async function readToken(env, token) {
  const [payload, sig] = String(token || "").split(".");
  if (!payload || !sig) return null;
  let ok = false;
  try { ok = await crypto.subtle.verify("HMAC", await hmacKey(env), b64urlToBytes(sig), enc.encode(payload)); } catch { return null; }
  if (!ok) return null;
  let p;
  try { p = JSON.parse(new TextDecoder().decode(b64urlToBytes(payload))); } catch { return null; }
  if (!p || typeof p.x !== "number" || p.x < Math.floor(Date.now() / 1000)) return null;
  return p;
}

/** Emails allowed to stream through the proxy with a Microsoft sign-in (owner + VISITOR_NAMES). */
export function msAllowed(env, email) {
  const list = [String(env.OWNER_EMAIL || "")];
  for (const pair of String(env.VISITOR_NAMES || "").split(",")) list.push(pair.split("=")[0] || "");
  return list.map(s => s.trim().toLowerCase()).filter(Boolean).includes(email);
}

/** Validates a token for streaming right now. */
export async function tokenAllows(env, token) {
  const p = await readToken(env, token);
  if (!p) return false;
  if (p.k === "family") {
    const rec = await env.FAMILY.get("u:" + p.e, "json");
    return rec?.status === "approved";
  }
  if (p.k === "ms") return msAllowed(env, p.e);
  return false;
}
