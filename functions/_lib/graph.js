// App-only Microsoft Graph access (Sites.Selected, read on the Papa's Memories site only) and media streaming.
import { ALLOWED } from "./allow.js";

let tokenCache = { value: null, exp: 0 };
const urlCache = new Map(); // "Folder/file" -> { url, exp }
const graphBase = env => env.GRAPH_BASE || "https://graph.microsoft.com/v1.0";

async function appToken(env) {
  if (tokenCache.value && Date.now() < tokenCache.exp) return tokenCache.value;
  const body = new URLSearchParams({
    client_id: env.GRAPH_CLIENT_ID,
    client_secret: env.GRAPH_CLIENT_SECRET,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials"
  });
  const tokenUrl = env.TOKEN_URL || `https://login.microsoftonline.com/${env.TENANT_ID}/oauth2/v2.0/token`;
  const r = await fetch(tokenUrl, { method: "POST", body });
  if (!r.ok) {
    // Report Microsoft's error code only (e.g. AADSTS7000215 = wrong secret value). Never the secret itself.
    let code = "";
    try { const e = await r.json(); code = [e.error, (e.error_codes || []).map(c => "AADSTS" + c).join(",")].filter(Boolean).join(" "); } catch { /* ignore */ }
    throw new Error(`token ${r.status}${code ? " " + code : ""}`);
  }
  const j = await r.json();
  tokenCache = { value: j.access_token, exp: Date.now() + Math.max(60, (j.expires_in || 3600) - 300) * 1000 };
  return tokenCache.value;
}

const itemPath = (env, folder, name) =>
  `${graphBase(env)}/sites/${env.SITE_ID}/drive/root:/${encodeURIComponent(folder)}/${encodeURIComponent(name)}`;

async function downloadUrl(env, key, folder, name, force = false) {
  const hit = urlCache.get(key);
  if (!force && hit && Date.now() < hit.exp) return hit.url;
  const r = await fetch(itemPath(env, folder, name), { headers: { Authorization: "Bearer " + await appToken(env) } });
  if (!r.ok) throw new Error("item " + r.status);
  const j = await r.json();
  const url = j["@microsoft.graph.downloadUrl"];
  if (!url) throw new Error("no download url");
  urlCache.set(key, { url, exp: Date.now() + 30 * 60 * 1000 });
  return url;
}

/** Parses "/api/family/<kind>/<Folder>/<file>" into an allow-listed { folder, name, key } or null. */
export function parseMediaPath(pathname, prefix) {
  if (!pathname.startsWith(prefix)) return null;
  const segs = pathname.slice(prefix.length).split("/").filter(Boolean);
  if (segs.length !== 2) return null;
  let folder, name;
  try { folder = decodeURIComponent(segs[0]); name = decodeURIComponent(segs[1]); } catch { return null; }
  const key = `${folder}/${name}`;
  return ALLOWED.has(key) ? { folder, name, key } : null;
}

const TYPES = { mp3: "audio/mpeg", mp4: "video/mp4", wav: "audio/wav", m4a: "audio/mp4" };
const PASS = ["content-length", "content-range", "accept-ranges", "last-modified", "etag"];

/** Streams the file, honouring Range, without exposing any SharePoint URL or header to the browser. */
export async function streamMedia(request, env, m) {
  const range = request.headers.get("Range");
  const get = async force => fetch(await downloadUrl(env, m.key, m.folder, m.name, force), {
    headers: range ? { Range: range } : {}, redirect: "follow"
  });
  let r = await get(false);
  if (r.status === 401 || r.status === 403 || r.status === 404) r = await get(true); // expired pre-auth URL
  if (!(r.status === 200 || r.status === 206)) return new Response("Unavailable", { status: 502, headers: { "x-upstream-status": String(r.status) } });

  const h = new Headers();
  for (const k of PASS) { const v = r.headers.get(k); if (v) h.set(k, v); }
  if (!h.has("accept-ranges")) h.set("accept-ranges", "bytes");
  h.set("content-type", TYPES[m.name.split(".").pop().toLowerCase()] || "application/octet-stream");
  h.set("content-disposition", "inline");
  h.set("cache-control", "private, no-store");
  h.set("x-content-type-options", "nosniff");
  return new Response(r.body, { status: r.status, headers: h });
}

export async function streamThumb(env, m) {
  const r = await fetch(`${itemPath(env, m.folder, m.name)}:/thumbnails/0/large/content`, {
    headers: { Authorization: "Bearer " + await appToken(env) }, redirect: "follow"
  });
  if (!r.ok) return new Response(null, { status: 404 });
  return new Response(r.body, {
    headers: { "content-type": r.headers.get("content-type") || "image/jpeg", "cache-control": "private, max-age=86400", "x-content-type-options": "nosniff" }
  });
}
