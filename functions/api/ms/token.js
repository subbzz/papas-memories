import { json, deny } from "../../_lib/access.js";
import { verifyMsIdToken } from "../../_lib/msid.js";
import { mintToken, msAllowed } from "../../_lib/mediatoken.js";

// POST with "Authorization: Bearer <Microsoft ID token>": media token for Dada / Mama.
export async function onRequestPost({ request, env }) {
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) return deny(403);
  const auth = request.headers.get("Authorization") || "";
  const who = await verifyMsIdToken(auth.replace(/^Bearer\s+/i, ""), env).catch(() => null);
  if (!who) return deny(401);
  if (!msAllowed(env, who.email)) return deny(403);
  return json({ mediaToken: await mintToken(env, who.email, "ms"), ttl: 6 * 3600 });
}
