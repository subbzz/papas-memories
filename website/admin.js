/* Owner-only approvals page. The API re-checks the Cloudflare Access identity on every call. */
(() => {
  "use strict";
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const when = s => s ? new Date(s).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" }) : "";
  let t;
  const toast = m => { const el = $("#toast"); el.textContent = m; el.classList.add("show"); clearTimeout(t); t = setTimeout(() => el.classList.remove("show"), 2200); };
  const BADGE = { pending: ["⏳", "Waiting for you"], approved: ["✅", "Approved"], denied: ["🚫", "Not allowed"] };

  /* ---------- Microsoft sign-in (same app as the memory box) ---------- */
  const CFG = window.PM_CONFIG;
  let msal = null, account = null;
  const ready = (async () => {
    if (!window.msal || !CFG) return;
    msal = new window.msal.PublicClientApplication({
      auth: { clientId: CFG.clientId, authority: `https://login.microsoftonline.com/${CFG.tenantId}`, redirectUri: location.origin + "/", navigateToLoginRequestUrl: true },
      cache: { cacheLocation: "sessionStorage" }
    });
    await msal.initialize();
    const res = await msal.handleRedirectPromise().catch(() => null);
    account = res?.account || msal.getAllAccounts()[0] || null;
    if (!account) $("#msSignIn").hidden = false;
  })();
  $("#msSignIn").addEventListener("click", async () => {
    await ready;
    msal.loginRedirect({ scopes: ["openid", "profile"], prompt: "select_account", redirectStartPage: location.href });
  });
  async function authHeader() {
    await ready;
    if (!msal || !account) return {};
    try { const t = await msal.acquireTokenSilent({ scopes: ["openid", "profile"], account }); return { Authorization: "Bearer " + t.idToken }; }
    catch { return {}; }
  }

  async function api(path, body) {
    const auth = await authHeader();
    const r = await fetch(path, body
      ? { method: "POST", headers: { "content-type": "application/json", ...auth }, body: JSON.stringify(body) }
      : { cache: "no-store", headers: auth });
    if (r.status === 401 || r.status === 403) {
      if (!auth.Authorization) $("#msSignIn").hidden = false;
      throw new Error(auth.Authorization ? "This page is only for Dada." : "Please sign in with your Microsoft account (button at the top right).");
    }
    const isJson = (r.headers.get("content-type") || "").includes("application/json");
    if (!isJson) throw new Error("The approvals service isn't switched on yet. Finish SETUP-FAMILY-ACCESS.md, then deploy from the Papa folder.");
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `Error ${r.status}`);
    return j;
  }

  function row(it) {
    const [emo, label] = BADGE[it.status] || ["❔", it.status];
    const btn = (act, text, cls) => `<button class="btn ${cls}" type="button" data-act="${act}" data-email="${esc(it.email)}">${text}</button>`;
    const actions = it.status === "pending" ? btn("approve", "✅ Approve", "btn-pink") + btn("deny", "🚫 Deny", "btn-ghost")
      : it.status === "approved" ? btn("revoke", "🔒 Remove access", "btn-ghost")
      : btn("approve", "✅ Approve", "btn-sun") + btn("reset", "🧹 Forget", "btn-ghost");
    return `<article class="admin-card status-${esc(it.status)}">
      <div class="who"><b>${esc(it.name || "(no name)")}</b> <span class="chip">${emo} ${esc(label)}</span><br>
        <span>${esc(it.email)}</span>${it.note ? `<p class="note-line">“${esc(it.note)}”</p>` : ""}
        <small>Asked ${esc(when(it.requestedAt))}${it.decidedAt ? ` · decided ${esc(when(it.decidedAt))}` : ""}</small></div>
      <div class="tools">${actions}</div></article>`;
  }

  async function load() {
    const list = $("#list");
    try {
      const { items } = await api("/api/admin/requests");
      const pending = items.filter(i => i.status === "pending");
      document.title = `${pending.length ? `(${pending.length}) ` : ""}Approvals · Papa's Memories`;
      list.innerHTML = items.length
        ? `<h2 class="section-title">⏳ Waiting <small>${pending.length}</small></h2>${pending.map(row).join("") || `<p class="empty">Nobody waiting. 🎉</p>`}
           <h2 class="section-title">📒 Everyone else</h2>${items.filter(i => i.status !== "pending").map(row).join("") || `<p class="empty">No one yet.</p>`}`
        : `<p class="empty">No requests yet. Share mem.ss3.dev/family with the family! 💌</p>`;
    } catch (e) { list.innerHTML = `<div class="msg">😿 ${esc(e.message)}</div>`; }
  }

  document.addEventListener("click", async e => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const act = b.dataset.act, email = b.dataset.email;
    if ((act === "revoke" || act === "deny") && !confirm(`${act === "revoke" ? "Remove access for" : "Deny"} ${email}?`)) return;
    b.disabled = true;
    try { await api("/api/admin/decide", { email, action: act }); toast({ approve: "✅ Approved!", deny: "🚫 Denied", revoke: "🔒 Access removed", reset: "🧹 Forgotten" }[act]); }
    catch (err) { toast(err.message); }
    if ($("#panel-log").hidden) load(); else loadLog();
  });
  $("#addForm").addEventListener("submit", async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    try { await api("/api/admin/decide", { email: f.get("email"), name: f.get("name"), action: "approve" }); toast("✅ Approved! They can sign in now."); e.target.reset(); }
    catch (err) { toast(err.message); }
    load();
  });
  /* ---------- sign-in log ---------- */
  const STATUS = { approved: "✅ Has access", pending: "⏳ Waiting", denied: "🚫 No access", none: "👀 Just looked" };
  const syd = iso => new Date(iso).toLocaleString("en-AU", { timeZone: "Australia/Sydney", weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
  async function loadLog() {
    const box = $("#log");
    try {
      const { items } = await api("/api/admin/log");
      if (!items.length) { box.innerHTML = `<p class="empty">No sign-ins yet.</p>`; return; }
      box.innerHTML = `<div class="table-wrap"><table class="log-table">
        <thead><tr><th>When (Sydney)</th><th>Who</th><th>How</th><th>Where</th><th>Access now</th><th></th></tr></thead>
        <tbody>${items.map(i => {
          const family = i.via !== "Microsoft";
          const badge = family ? (STATUS[i.current] || i.current) : "🏠 Family (Microsoft)";
          const action = family && i.current === "approved"
            ? `<button class="btn btn-ghost" type="button" data-act="revoke" data-email="${esc(i.email)}">🔒 Remove access</button>` : "";
          const who = family ? esc(i.email) : `<b>${esc(i.who)}</b>`;
          return `<tr><td>${esc(syd(i.t))}</td><td>${who}</td><td>${esc(i.via)}</td><td>${esc(i.place || "")}</td><td>${esc(badge)}</td><td>${action}</td></tr>`;
        }).join("")}</tbody></table></div>`;
    } catch (e) { box.innerHTML = `<div class="msg">😿 ${esc(e.message)}</div>`; }
  }

  /* ---------- health check ---------- */
  $("#healthBtn").addEventListener("click", async () => {
    const box = $("#health");
    box.innerHTML = `<div class="msg loading"><span class="spinner">🌀</span> Testing the streaming chain…</div>`;
    try {
      const h = await api("/api/admin/health");
      const cfg = Object.entries(h.config).map(([k, v]) => `${esc(k)}: <b>${esc(v === true ? "✅" : v === false ? "❌" : v)}</b>`).join(" · ");
      box.innerHTML = `<div class="msg"><b>🩺 Streaming check</b><br><small>${cfg}</small><ul>${h.steps.map(s => `<li>${s.ok ? "✅" : "❌"} ${esc(s.name)} <small>${esc(s.detail)}</small></li>`).join("")}</ul></div>`;
    } catch (e) { box.innerHTML = `<div class="msg">😿 ${esc(e.message)}</div>`; }
  });

  /* ---------- tabs ---------- */
  function show(tab) {
    for (const t of ["approvals", "log"]) {
      $("#panel-" + t).hidden = t !== tab;
      $("#tab-" + t).setAttribute("aria-selected", String(t === tab));
    }
    if (tab === "log") loadLog(); else load();
    history.replaceState(null, "", "#" + tab);
  }
  document.querySelectorAll("[data-tab]").forEach(b => b.addEventListener("click", () => show(b.dataset.tab)));
  show(location.hash === "#log" ? "log" : "approvals");
})();
