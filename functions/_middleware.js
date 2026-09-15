// Cloudflare's "Verify you are human" challenge re-sends the original page request as a POST once solved.
// Static Pages assets only accept GET/HEAD and answer 405, so bounce page POSTs back to a normal GET.
// API routes are untouched (they have their own method handlers).
export async function onRequest(ctx) {
  const { request } = ctx;
  if (request.method !== "POST") return ctx.next();
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/cdn-cgi/")) return ctx.next();
  for (const k of [...url.searchParams.keys()]) if (k.startsWith("__cf_chl")) url.searchParams.delete(k);
  return new Response(null, {
    status: 303,
    headers: { Location: url.pathname + url.search, "cache-control": "no-store" }
  });
}
