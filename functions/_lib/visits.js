// Sign-in log kept in KV. Keys sort newest-first; entries expire after a year.
const MAX_TS = 9999999999999;

/** Friendly names for Microsoft accounts, from VISITOR_NAMES="a@x=Dada,b@x=Mama". */
export function friendlyName(env, email) {
  for (const pair of String(env.VISITOR_NAMES || "").split(",")) {
    const [e, n] = pair.split("=").map(x => (x || "").trim());
    if (e && n && e.toLowerCase() === email) return n;
  }
  return email;
}

/**
 * Records a sign-in, at most once per `throttleMin` per person (a page refresh isn't a new visit).
 * `via` is "Microsoft" or "Family email code".
 */
export async function logVisit(env, request, { email, who, via, status }, throttleMin = 30) {
  const seenKey = "seen:" + email;
  if (await env.FAMILY.get(seenKey)) return false;
  await env.FAMILY.put(seenKey, "1", { expirationTtl: Math.max(60, throttleMin * 60) });
  const now = Date.now();
  const cf = request.cf || {};
  const entry = {
    t: new Date(now).toISOString(), email, who, via, status: status || "",
    place: [cf.city, cf.country].filter(Boolean).join(", ")
  };
  const key = `log:${String(MAX_TS - now).padStart(13, "0")}:${crypto.randomUUID().slice(0, 8)}`;
  await env.FAMILY.put(key, JSON.stringify(entry), { expirationTtl: 366 * 24 * 3600 });
  return true;
}

export async function readLog(env, limit = 300) {
  const out = [];
  let cursor;
  do {
    const page = await env.FAMILY.list({ prefix: "log:", cursor, limit: Math.min(1000, limit) });
    const vals = await Promise.all(page.keys.map(k => env.FAMILY.get(k.name, "json")));
    for (const v of vals) if (v) out.push(v);
    cursor = page.list_complete || out.length >= limit ? undefined : page.cursor;
  } while (cursor);
  return out.slice(0, limit);
}
