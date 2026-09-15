import { requireOwner, json, deny } from "../../_lib/access.js";
import { mintToken, tokenAllows } from "../../_lib/mediatoken.js";
import { streamMedia } from "../../_lib/graph.js";

// GET: owner-only end-to-end check of the streaming chain. Never returns secrets or SharePoint URLs.
export async function onRequestGet({ request, env }) {
  if (!await requireOwner(request, env)) return deny(403);
  const out = { config: {}, steps: [] };
  const add = (name, ok, detail = "") => out.steps.push({ name, ok, detail });
  out.config = {
    graphClientId: !!env.GRAPH_CLIENT_ID, graphSecret: !!env.GRAPH_CLIENT_SECRET, siteId: !!env.SITE_ID,
    kv: !!env.FAMILY, teamDomain: env.TEAM_DOMAIN || "", familyAud: !!env.FAMILY_AUD, turnstileSecret: !!env.TURNSTILE_SECRET
  };
  try {
    const t = await mintToken(env, String(env.OWNER_EMAIL).toLowerCase(), "ms", 60);
    add("Sign a media link", true);
    add("Check the media link", await tokenAllows(env, t));
  } catch (e) { add("Sign a media link", false, String(e.message || e)); }
  for (const [folder, name] of [["Audio", "HBD.mp3"], ["Mama", "Mama-Tape-01.mp3"], ["Video", "Kural [jHKqDWkEsz8].mp4"]]) {
    try {
      const r = await streamMedia(new Request(request.url, { headers: { Range: "bytes=0-1" } }), env, { folder, name, key: `${folder}/${name}` });
      const detail = `HTTP ${r.status} · ${r.headers.get("content-type")} · ${r.headers.get("content-range") || "no range"}`;
      await r.body?.cancel();
      add(`Stream ${folder}/${name} (first 2 bytes)`, r.status === 206, detail);
    } catch (e) { add(`Stream ${folder}/${name}`, false, String(e.message || e)); }
  }
  return json(out);
}
