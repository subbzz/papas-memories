import { requireOwner, json, deny } from "../../_lib/access.js";

// GET: every family entry (pending, approved, denied), newest first.
export async function onRequestGet({ request, env }) {
  if (!await requireOwner(request, env)) return deny(403);
  const out = [];
  let cursor;
  do {
    const page = await env.FAMILY.list({ prefix: "u:", cursor });
    for (const k of page.keys) { const v = await env.FAMILY.get(k.name, "json"); if (v) out.push(v); }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  out.sort((a, b) => String(b.requestedAt).localeCompare(String(a.requestedAt)));
  return json({ items: out });
}
