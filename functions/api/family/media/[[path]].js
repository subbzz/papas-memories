import { familyUser, isApproved, deny } from "../../../_lib/access.js";
import { parseMediaPath, streamMedia } from "../../../_lib/graph.js";

export async function onRequestGet({ request, env }) {
  const u = await familyUser(request, env);
  if (!u) return deny(401);
  if (!isApproved(u)) return deny(403);
  const m = parseMediaPath(new URL(request.url).pathname, "/api/family/media/");
  if (!m) return new Response("Not found", { status: 404 });
  try { return await streamMedia(request, env, m); }
  catch { return new Response("Unavailable", { status: 502 }); }
}
