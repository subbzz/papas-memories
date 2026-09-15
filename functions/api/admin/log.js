import { requireOwner, json, deny } from "../../_lib/access.js";
import { readLog } from "../../_lib/visits.js";

// GET: newest sign-ins first, with each family member's current approval status.
export async function onRequestGet({ request, env }) {
  if (!await requireOwner(request, env)) return deny(403);
  const items = await readLog(env, 300);
  const emails = [...new Set(items.filter(i => i.via !== "Microsoft").map(i => i.email))];
  const recs = await Promise.all(emails.map(e => env.FAMILY.get("u:" + e, "json")));
  const current = Object.fromEntries(emails.map((e, i) => [e, recs[i]?.status || "none"]));
  return json({ items: items.map(i => ({ ...i, current: i.via === "Microsoft" ? null : current[i.email] })) });
}
