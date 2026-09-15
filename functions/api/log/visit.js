import { json, deny } from "../../_lib/access.js";
import { verifyMsIdToken } from "../../_lib/msid.js";
import { friendlyName, logVisit } from "../../_lib/visits.js";

// POST with "Authorization: Bearer <Microsoft ID token>": records a Microsoft sign-in (Dada / Mama).
export async function onRequestPost({ request, env }) {
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) return deny(403);
  const auth = request.headers.get("Authorization") || "";
  const who = await verifyMsIdToken(auth.replace(/^Bearer\s+/i, ""), env).catch(() => null);
  if (!who) return deny(401);
  await logVisit(env, request, { email: who.email, who: friendlyName(env, who.email), via: "Microsoft" });
  return json({ ok: true });
}
