import { requireOwner, json, deny } from "../../_lib/access.js";

const ACTIONS = { approve: "approved", deny: "denied", revoke: "denied", reset: null };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST { email, action: approve|deny|revoke|reset, name? }. "approve" can also pre-approve someone who hasn't asked yet.
export async function onRequestPost({ request, env }) {
  if (!await requireOwner(request, env)) return deny(403);
  // CSRF defence: JSON only, same origin only.
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) return deny(403);
  if (!(request.headers.get("content-type") || "").includes("application/json")) return json({ error: "json only" }, 415);
  let body;
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  const email = String(body.email || "").trim().toLowerCase();
  if (!EMAIL.test(email) || !Object.hasOwn(ACTIONS, body.action)) return json({ error: "bad request" }, 400);
  const key = "u:" + email;
  if (body.action === "reset") { await env.FAMILY.delete(key); return json({ ok: true }); }
  const rec = (await env.FAMILY.get(key, "json")) ||
    { email, name: String(body.name || "").replace(/[\p{Cc}<>]/gu, "").slice(0, 60), note: "Added by Dada", requestedAt: new Date().toISOString() };
  rec.status = ACTIONS[body.action];
  rec.decidedAt = new Date().toISOString();
  await env.FAMILY.put(key, JSON.stringify(rec));
  return json({ ok: true, item: rec });
}
