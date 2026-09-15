import { familyUser, isApproved, deny } from "../../../_lib/access.js";
import { parseMediaPath, streamThumb } from "../../../_lib/graph.js";

export async function onRequestGet({ request, env }) {
  const u = await familyUser(request, env);
  if (!u) return deny(401);
  if (!isApproved(u)) return deny(403);
  const m = parseMediaPath(new URL(request.url).pathname, "/api/family/thumb/");
  if (!m || m.folder !== "Video") return new Response(null, { status: 404 });
  try { return await streamThumb(env, m); }
  catch { return new Response(null, { status: 404 }); }
}
