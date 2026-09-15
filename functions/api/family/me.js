import { familyUser, json, deny } from "../../_lib/access.js";
import { logVisit } from "../../_lib/visits.js";
import { mintToken } from "../../_lib/mediatoken.js";

// GET: who am I, and what is my approval status? Also records the sign-in (throttled).
export async function onRequestGet({ request, env, waitUntil }) {
  const u = await familyUser(request, env);
  if (!u) return deny();
  const r = u.rec;
  const status = r?.status || "none";
  waitUntil(logVisit(env, request, { email: u.email, who: u.email, via: "Family email code", status }).catch(() => {}));
  const mediaToken = status === "approved" ? await mintToken(env, u.email, "family") : undefined;
  return json({ email: u.email, status, name: r?.name || "", mediaToken, ttl: mediaToken ? 6 * 3600 : undefined });
}
