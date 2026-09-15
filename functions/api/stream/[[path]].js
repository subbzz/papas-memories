import { tokenAllows } from "../../_lib/mediatoken.js";
import { parseMediaPath, streamMedia, streamThumb } from "../../_lib/graph.js";

// GET /api/stream/<token>/<Folder>/<file>         -> audio/video (Range supported)
// GET /api/stream/<token>/thumb/<Folder>/<file>   -> video thumbnail
// Works without cookies (iPhone media players). The token is short-lived and re-checked on every request.
export async function onRequestGet({ request, env }) {
  const path = new URL(request.url).pathname;
  const rest = path.slice("/api/stream/".length);
  const token = rest.split("/")[0];
  if (!token || !(await tokenAllows(env, token).catch(() => false))) {
    return new Response("Forbidden", { status: 403, headers: { "cache-control": "no-store" } });
  }
  const base = `/api/stream/${token}/`;
  if (path.startsWith(base + "thumb/")) {
    const m = parseMediaPath(path, base + "thumb/");
    if (!m || m.folder !== "Video") return new Response(null, { status: 404 });
    try { return await streamThumb(env, m); } catch { return new Response(null, { status: 404 }); }
  }
  const m = parseMediaPath(path, base);
  if (!m) return new Response("Not found", { status: 404 });
  try { return await streamMedia(request, env, m); }
  catch { return new Response("Unavailable", { status: 502 }); }
}
