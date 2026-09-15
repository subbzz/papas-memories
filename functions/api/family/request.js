import { familyUser, json, deny } from "../../_lib/access.js";

// Strip control characters and angle brackets from free text.
const clean = (s, max) => String(s ?? "").replace(/[\p{Cc}<>]/gu, "").trim().slice(0, max);

// POST { name, note }: ask Dada for access. Re-requesting never overrides an approval or a denial.
export async function onRequestPost({ request, env, waitUntil }) {
  const u = await familyUser(request, env);
  if (!u) return deny();
  if (u.rec && u.rec.status !== "none") return json({ status: u.rec.status });
  let body = {};
  try { body = await request.json(); } catch { /* empty */ }
  if (env.TURNSTILE_SECRET) {
    const form = new FormData();
    form.append("secret", env.TURNSTILE_SECRET);
    form.append("response", String(body.turnstile || ""));
    const ip = request.headers.get("CF-Connecting-IP"); if (ip) form.append("remoteip", ip);
    const v = await fetch(env.TURNSTILE_VERIFY_URL || "https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form })
      .then(r => r.json()).catch(() => ({ success: false }));
    if (!v.success || (v.hostname && v.hostname !== new URL(request.url).hostname && !env.TURNSTILE_VERIFY_URL)) {
      return json({ error: "Please tick the \"I'm human\" box and try again." }, 400);
    }
  }
  const name = clean(body.name, 60);
  if (!name) return json({ error: "Please tell us your name." }, 400);
  const rec = { email: u.email, name, note: clean(body.note, 200), status: "pending", requestedAt: new Date().toISOString() };
  await env.FAMILY.put("u:" + u.email, JSON.stringify(rec));
  if (env.NOTIFY_WEBHOOK) {
    // Optional ping (e.g. ntfy, Teams, n8n). Sends the requester's name, email and note only.
    waitUntil(fetch(env.NOTIFY_WEBHOOK, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: "access_request", site: "mem.ss3.dev", name, email: u.email, note: rec.note, approve: "https://mem.ss3.dev/admin/" })
    }).catch(() => {}));
  }
  return json({ status: "pending" });
}
