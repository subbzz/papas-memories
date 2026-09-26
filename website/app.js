/* Papa's Memories: MSAL sign-in + Microsoft Graph media from SharePoint. No secrets in this file. */
(() => {
  "use strict";
  const msalBrowser = window.msal; // UMD global exposed by vendor/msal-browser.min.js
  const CFG = window.PM_CONFIG;
  const DATA = window.MEMORIES;
  const CATS = Object.fromEntries(DATA.cats.map(c => [c.id, c]));
  const ITEMS = DATA.items;
  const BY_SLUG = Object.fromEntries(ITEMS.map((it, i) => [it.slug, Object.assign(it, { idx: i })]));
  const GRAPH = "https://graph.microsoft.com/v1.0";
  const URL_TTL_MS = 45 * 60 * 1000; // Graph download URLs are short-lived; refresh well before expiry
  // Local preview only: ?demo on localhost renders the UI without signing in (no media).
  // Family mode (/family/): Cloudflare Access sign-in + Dada's approval; media via the site's own proxy.
  const FAMILY = location.pathname.startsWith("/family");
  const DEMO = ["localhost", "127.0.0.1"].includes(location.hostname) && new URLSearchParams(location.search).has("demo");

  const $ = (s, el = document) => el.querySelector(s);
  const app = $("#app");
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const tilt = i => ((i * 37) % 9 - 4) * 0.8; // deterministic playful rotation
  /* ---------- the two treasure boxes (worlds) ---------- */
  const WORLDS = {
    papa: { id: "papa", emoji: "👨‍👧", name: "Papa's Memories", color: "#ffd166", jar: ["🎂", "🐣", "🦁", "🎒", "🎵", "🏠", "📼", "🎙️", "🎈", "⭐", "🧸", "🎠"],
      blurb: "Her tiny voice, birthday cakes, zoo days, dance class and giggles, caught on Papa's camera and tape.",
      cats: DATA.cats.filter(c => !c.id.startsWith("mama")).map(c => c.id) },
    mama: { id: "mama", emoji: "👩‍👧", name: "Mama's Memories", color: "#ffafcc", jar: ["💐", "📻", "🌸", "☕", "💌", "🎀", "🌷", "📼", "🦋", "💖", "🌙", "🧁"],
      blurb: "Mama's own childhood tapes, her coming-of-age ceremony and Dada and Mama's wedding day. Grab a cuppa!",
      cats: DATA.cats.filter(c => c.id.startsWith("mama")).map(c => c.id) }
  };
  const WORLD_OF = Object.fromEntries(Object.values(WORLDS).flatMap(w => w.cats.map(id => [id, w])));
  const worldItems = w => ITEMS.filter(it => w.cats.includes(it.cat));
  const catHref = id => WORLD_OF[id].cats.length === 1 ? `#/${WORLD_OF[id].id}` : `#/c/${id}`;
  const TAPES = ["rgba(255,201,60,.8)", "rgba(255,93,143,.6)", "rgba(76,201,240,.6)", "rgba(128,237,153,.7)", "rgba(179,146,240,.6)"];

  /* ---------- local prefs (per browser only) ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem("pm:" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("pm:" + k, JSON.stringify(v)); } catch { /* ignore */ } }
  };
  let favs = new Set(store.get("favs", []));
  // "New since your last visit": compare each memory's added-date with the last time this browser opened the site.
  const LAST_SEEN = store.get("lastSeen", 0);
  const NEW = new Set(LAST_SEEN ? ITEMS.filter(it => it.added && Date.parse(it.added + "T00:00:00Z") > LAST_SEEN).map(it => it.slug) : []);
  store.set("lastSeen", Date.now());
  const saveFavs = () => { store.set("favs", [...favs]); $("#favCount").textContent = favs.size; };

  /* ---------- toast + confetti ---------- */
  // (music.js uses this to explain a silent phone)
  let toastTimer;
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
  }
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.PM_TOAST = msg => toast(msg);
  function confetti(n = 120) {
    if (reduceMotion) return;
    const cv = $("#confetti"), ctx = cv.getContext("2d");
    const W = cv.width = innerWidth * devicePixelRatio, H = cv.height = innerHeight * devicePixelRatio;
    const colors = ["#ff5d8f", "#ffc93c", "#4cc9f0", "#80ed99", "#b392f0", "#ff9f43"];
    const parts = Array.from({ length: n }, () => ({
      x: W / 2 + (Math.random() - .5) * W * .3, y: H * .35, vx: (Math.random() - .5) * 18 * devicePixelRatio,
      vy: (-Math.random() * 16 - 6) * devicePixelRatio, s: (6 + Math.random() * 8) * devicePixelRatio,
      c: colors[(Math.random() * colors.length) | 0], r: Math.random() * 6, vr: (Math.random() - .5) * .3
    }));
    let frame = 0;
    (function tick() {
      ctx.clearRect(0, 0, W, H);
      parts.forEach(p => {
        p.vy += .45 * devicePixelRatio; p.x += p.vx; p.y += p.vy; p.vx *= .99; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore();
      });
      if (++frame < 160) requestAnimationFrame(tick); else ctx.clearRect(0, 0, W, H);
    })();
  }

  /* ---------- auth ---------- */
  let msal, account;
  async function initAuth() {
    msal = new msalBrowser.PublicClientApplication({
      auth: {
        clientId: CFG.clientId,
        authority: `https://login.microsoftonline.com/${CFG.tenantId}`,
        redirectUri: location.origin + "/",
        postLogoutRedirectUri: location.origin + "/",
        navigateToLoginRequestUrl: true
      },
      cache: { cacheLocation: "sessionStorage", storeAuthStateInCookie: false }
    });
    await msal.initialize();
    const res = await msal.handleRedirectPromise();
    account = res?.account || msal.getAllAccounts()[0] || null;
    if (account) msal.setActiveAccount(account);
  }
  // Only the site owner sees links to the SharePoint originals.
  const isOwner = () => !DEMO && (account?.username || "").toLowerCase() === (CFG.ownerUpn || "").toLowerCase();
  // Tell the site log that Dada / Mama signed in (once per browser session). The server verifies the ID token.
  async function logSignIn() {
    try {
      if (sessionStorage.getItem("pm:logged") === account.homeAccountId) return;
      const res = await msal.acquireTokenSilent({ scopes: CFG.scopes, account });
      const r = await fetch("/api/log/visit", { method: "POST", headers: { Authorization: "Bearer " + res.idToken } });
      if (r.ok) sessionStorage.setItem("pm:logged", account.homeAccountId);
    } catch { /* logging must never block the memories */ }
  }
  async function token() {
    try {
      return (await msal.acquireTokenSilent({ scopes: CFG.scopes, account })).accessToken;
    } catch (e) {
      if (e instanceof msalBrowser.InteractionRequiredAuthError) {
        await msal.acquireTokenRedirect({ scopes: CFG.scopes, account });
        return new Promise(() => {}); // page is navigating away
      }
      throw e;
    }
  }
  async function graph(path) {
    const r = await fetch(path.startsWith("http") ? path : GRAPH + path, { headers: { Authorization: "Bearer " + await token() } });
    if (!r.ok) {
      let detail = ""; try { detail = (await r.json()).error?.message || ""; } catch { /* ignore */ }
      throw new Error(`Graph ${r.status}${detail ? ": " + detail : ""}`);
    }
    return r.json();
  }

  /* ---------- media index from SharePoint ---------- */
  let media = new Map(); // "Folder/file" -> {id, url, thumb, webUrl}
  let mediaAt = 0, siteId = null, mediaPromise = null;
  /* Signed, short-lived media links: players that don't send cookies (iPhone/iPad) can still stream. */
  let mediaToken = null, tokenAt = 0;
  const TOKEN_REFRESH_MS = 5 * 3600 * 1000;
  const streamUrl = (tok, it) => `/api/stream/${tok}/${encodeURIComponent(it.folder)}/${encodeURIComponent(it.file)}`;
  const thumbUrl = (tok, it) => `/api/stream/${tok}/thumb/${encodeURIComponent(it.folder)}/${encodeURIComponent(it.file)}`;
  async function ensureToken(force = false) {
    if (!force && mediaToken && Date.now() - tokenAt < TOKEN_REFRESH_MS) return mediaToken;
    try {
      if (FAMILY) {
        const r = await fetch("/api/family/me", { cache: "no-store", credentials: "same-origin" });
        if (!r.ok) return null;
        const j = await r.json();
        if (j.status !== "approved") return null;
        mediaToken = j.mediaToken || null;
        setWho(j.name);
      } else if (!DEMO && msal && account) {
        const res = await msal.acquireTokenSilent({ scopes: CFG.scopes, account });
        const r = await fetch("/api/ms/token", { method: "POST", headers: { Authorization: "Bearer " + res.idToken } });
        const j = r.ok ? await r.json() : {};
        mediaToken = j.mediaToken || null;
        setWho(j.name || (account.name || "").split(" ")[0]);
      }
    } catch { mediaToken = null; }
    tokenAt = Date.now();
    return mediaToken;
  }

  async function loadMedia(force = false) {
    if (FAMILY) {
      const tok = await ensureToken(force);
      if (!tok) throw new Error("Your access has changed. Please refresh the page.");
      if (force || !media.size || media.__tok !== tok) {
        media = new Map();
        for (const it of ITEMS) media.set(`${it.folder}/${it.file}`, { url: streamUrl(tok, it), thumb: it.kind === "video" ? thumbUrl(tok, it) : it.kind === "image" ? streamUrl(tok, it) : null, webUrl: null });
        media.__tok = tok;
      }
      return media;
    }
    if (DEMO) { if (window.__PM_TEST_MEDIA && !media.size) media = new Map(Object.entries(window.__PM_TEST_MEDIA)); return media; }
    if (!force && media.size && Date.now() - mediaAt < URL_TTL_MS) return media;
    if (mediaPromise) return mediaPromise;
    mediaPromise = (async () => {
      if (!siteId) siteId = (await graph(`/sites/${CFG.siteHost}:${CFG.sitePath}?$select=id`)).id;
      const next = new Map();
      for (const folder of CFG.folders) {
        let url = `/sites/${siteId}/drive/root:/${encodeURIComponent(folder)}:/children?$top=200&$expand=thumbnails`;
        while (url) {
          let page;
          try { page = await graph(url); }
          catch (e) { if (/Graph 404/.test(e.message)) { console.warn(`Folder ${folder} not found`); break; } throw e; }
          for (const f of page.value || []) {
            if (!f.file) continue;
            const th = f.thumbnails?.[0];
            next.set(`${folder}/${f.name}`, {
              id: f.id, url: f["@microsoft.graph.downloadUrl"], webUrl: f.webUrl,
              thumb: th?.large?.url || th?.medium?.url || null
            });
          }
          url = page["@odata.nextLink"] || null;
        }
      }
      const tok = await ensureToken(force);
      if (tok) for (const it of ITEMS) { const m = next.get(`${it.folder}/${it.file}`); if (m) m.url = streamUrl(tok, it); }
      media = next; mediaAt = Date.now();
      return media;
    })();
    try { return await mediaPromise; } finally { mediaPromise = null; }
  }
  const mediaFor = it => media.get(`${it.folder}/${it.file}`);

  /* ---------- rendering helpers ---------- */
  function polaroid(it, i) {
    const c = CATS[it.cat];
    const m = mediaFor(it);
    const photo = it.kind === "audio"
      ? `<div class="mini-cassette"><i></i><i></i></div>`
      : (m?.thumb ? `<img src="${esc(m.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="ph-emo">${it.emoji}</span>`);
    const badge = it.kind === "audio" ? "🎧" : it.kind === "image" ? "🔍" : "▶";
    return `<a class="polaroid" href="#/m/${it.slug}" data-r="${tilt(i)}" data-tape="${TAPES[i % TAPES.length]}" data-c="${c.color}">
      <div class="photo">${photo}<span class="play" aria-hidden="true">${badge}</span></div>
      <span class="emo-badge" aria-hidden="true">${it.emoji}</span>
      ${favs.has(it.slug) ? `<span class="fav-dot" title="Favourite">💖</span>` : ""}
      ${NEW.has(it.slug) ? `<span class="new-dot" title="New since your last visit">✨</span>` : ""}
      <div class="cap">${esc(it.title)}</div>${it.shared ? `<div class="cap-date">📮 shared ${esc(sharedText(it, true))}</div>` : ""}</a>`;
  }
  function applyVars(root = app) {
    root.querySelectorAll("[data-r]").forEach(el => el.style.setProperty("--r", el.dataset.r + "deg"));
    root.querySelectorAll("[data-c]").forEach(el => el.style.setProperty("--c", el.dataset.c));
    root.querySelectorAll("[data-tape]").forEach(el => {
      el.style.setProperty("--tape", el.dataset.tape);
      el.style.setProperty("--tr", (Math.random() * 8 - 4).toFixed(1) + "deg");
    });
  }
  function loadingHtml(text) { return `<div class="msg loading"><span class="spinner">🌀</span> ${esc(text)}</div>`; }
  function errorHtml(e) {
    return `<div class="msg"><b>😿 Oops, the memory box got stuck.</b><br>${esc(e.message || e)}<br><br>
      <button class="btn btn-sun" type="button" data-act="retry">🔄 Try again</button></div>`;
  }
  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  function sharedText(it, short = false) {
    if (!it.shared) return "";
    const [d, t] = it.shared.split("T"); const [y, m, day] = d.split("-").map(Number);
    if (short) return `${MONTHS[m - 1].slice(0, 3)} ${y}`;
    if (it.sharedPrecision === "month") return `${MONTHS[m - 1]} ${y}`;
    let [hh, mm] = t.split(":").map(Number); const ap = hh >= 12 ? "pm" : "am"; hh = hh % 12 || 12;
    const wd = new Date(Date.UTC(y, m - 1, day)).toLocaleDateString("en-AU", { weekday: "long", timeZone: "UTC" });
    return `${wd} ${day} ${MONTHS[m - 1]} ${y}, ${hh}:${String(mm).padStart(2, "0")} ${ap}`;
  }
  function setTitle(t) { document.title = !t ? "Papa & Mama Memories" : /Memories$/.test(t) ? t : `${t} · Papa & Mama Memories`; }

  /* ---------- views ---------- */
  /* ---------- personal greeting (names Dada set: VISITOR_NAMES for Microsoft, approval name for family) ---------- */
  let WHO = "";
  function greetText() {
    const h = new Date().getHours();
    const hi = h < 5 ? "Hello, night owl" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : h < 21 ? "Good evening" : "Hello, night owl";
    return WHO ? `${hi}, ${WHO}! 💛` : `${hi}! 💛`;
  }
  function setWho(name) {
    const n = String(name || "").trim().slice(0, 40);
    if (!n || n === WHO) return;
    WHO = n;
    try { sessionStorage.setItem("pm:who", n); } catch { /* ignore */ }
    const el = $("#hello"); if (el) el.textContent = greetText();
    try { if (!sessionStorage.getItem("pm:welcomed")) { sessionStorage.setItem("pm:welcomed", "1"); toast(`💛 Welcome, ${n}!`); } } catch { /* ignore */ }
  }

  function jarHtml(emojis, count, word = "memories") {
    const fill = Array.from({ length: 48 }, (_, i) => `<span data-d="${(i % 7) * 0.3}">${emojis[i % emojis.length]}</span>`).join("");
    return `<div class="jar" aria-label="${count} ${word} in the jar"><div class="label"><b>${count}</b>${word}</div><div class="fill">${fill}</div></div>`;
  }
  function bobJar() { app.querySelectorAll(".jar .fill span").forEach(s => s.style.animationDelay = `-${s.dataset.d}s`); }

  function todaysPick() {
    const d = new Date(), key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    let h = 0; for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0; // same memory for everyone, all day
    return ITEMS[h % ITEMS.length];
  }
  function viewNew() {
    setTitle("New memories");
    const list = ITEMS.filter(it => NEW.has(it.slug));
    app.innerHTML = `
      <div class="crumbs"><a class="chip" href="#/">🏠 Home</a></div>
      <h1 class="section-title flush">✨ New since your last visit</h1>
      <div id="wall">${list.length ? loadingHtml("Fetching the new ones…") : `<p class="empty">Nothing new right now. Check back soon! 💛</p>`}</div>`;
    if (!list.length) return;
    loadMedia().then(() => { const w = $("#wall"); if (!w) return; w.innerHTML = `<div class="wall">${list.map(it => polaroid(it, it.idx)).join("")}</div>`; applyVars(w); })
      .catch(e => { const w = $("#wall"); if (w) w.innerHTML = errorHtml(e); });
  }

  function viewLanding() {
    setTitle("");
    const card = (w, i) => {
      const list = worldItems(w);
      const audio = list.filter(x => x.kind === "audio").length, video = list.length - audio;
      const bits = [audio && `🎧 ${audio} tapes`, video && `🎬 ${video} videos`].filter(Boolean).join(" · ");
      const peek = w.jar.slice(0, 6).map((e, k) => `<span data-d="${k * 0.35}">${e}</span>`).join("");
      return `<a class="world-card" href="#/${w.id}" data-c="${w.color}" data-r="${i ? 1.5 : -1.5}">
        <span class="world-ribbon">${i ? "Mama's side" : "Papa's side"}</span>
        <span class="world-emo" aria-hidden="true">${w.emoji}</span>
        <h2>${esc(w.name)}</h2>
        <p>${esc(w.blurb)}</p>
        <span class="world-peek" aria-hidden="true">${peek}</span>
        <span class="world-foot"><span class="count">${bits}</span><span class="btn btn-pink">Open ${i ? "Mama's" : "Papa's"} box →</span></span>
      </a>`;
    };
    app.innerHTML = `
      <section class="landing">
        <p class="landing-hello" id="hello"></p>
        <h1 class="landing-title">Two treasure boxes, <span class="pop">one</span> happy family.</h1>
        <p class="landing-sub">Whose memories shall we open today?</p>
        <div class="worlds">${card(WORLDS.papa, 0)}${card(WORLDS.mama, 1)}</div>
        ${(() => { const t = todaysPick(); const w = WORLD_OF[t.cat];
          return `<a class="today" href="#/m/${t.slug}" data-c="${w.color}">
            <span class="today-tag">🌞 Today's memory</span>
            <span class="today-emo" aria-hidden="true">${t.emoji}</span>
            <span class="today-title">${esc(t.title)}</span>
            <span class="today-cap">${esc(t.caption)}</span>
            <span class="btn btn-pink">▶ Play today's memory</span></a>`; })()}
        ${NEW.size ? `<a class="new-chip" href="#/new">✨ ${NEW.size} new since your last visit</a>` : ""}
        <div class="landing-actions"><button class="btn btn-big btn-sun" type="button" data-act="shuffle">🎲 Surprise me from anywhere!</button>
          <a class="btn btn-big btn-ghost" href="#/favourites">💖 My favourites</a></div>
      </section>`;
    $("#hello").textContent = greetText();
    applyVars();
    app.querySelectorAll(".world-peek span").forEach(s => s.style.animationDelay = `-${s.dataset.d}s`);
  }

  function viewWorld(wid) {
    const w = WORLDS[wid]; if (!w) return viewLanding();
    const list = worldItems(w);
    const cats = DATA.cats.filter(c => w.cats.includes(c.id));
    const single = cats.length === 1;
    setTitle(w.name);
    const headline = wid === "mama"
      ? `Once upon a time, <span class="pop">Mama</span> was a little girl too.`
      : `Once upon a time, a <span class="pop">little girl</span> made <span class="pop">big</span> memories.`;
    app.innerHTML = `
      <div class="crumbs"><a class="chip" href="#/">🏠 Home</a><span class="chip" data-c="${w.color}">${w.emoji} ${esc(w.name)}</span></div>
      <section class="hero world-${wid}">
        <div>
          <h1>${headline}</h1>
          <p>${esc(w.blurb)} Every clip has its own page. Pick one, or let the jar choose!</p>
          <div class="hero-actions">
            <button class="btn btn-big btn-pink" type="button" data-act="shuffle">🎲 Surprise me!</button>
            ${single ? `<button class="btn btn-big btn-sun" type="button" data-act="play-cat" data-cat="${cats[0].id}">▶ Play them all</button>` : ""}
            <label class="search"><span aria-hidden="true">🔎</span><input id="q" type="search" placeholder="${wid === "mama" ? "Find a tape…" : "Find a memory… (cake, zoo, song)"}" aria-label="Search ${esc(w.name)}"></label>
          </div>
        </div>
        ${jarHtml(w.jar, list.length, single ? "tapes" : "memories")}
      </section>
      ${single ? "" : `<h2 class="section-title">📦 Pick a memory box</h2>
      <div class="stickers">${cats.map((c, i) => `
        <a class="sticker" href="#/c/${c.id}" data-c="${c.color}" data-r="${tilt(i + 3)}">
          <span class="emo">${c.emoji}</span><h3>${esc(c.name)}</h3><p>${esc(c.blurb)}</p>
          <span class="count">${c.count} ${["tapes", "mama"].includes(c.id) ? "tapes" : "clips"}</span></a>`).join("")}
      </div>`}
      <div id="results"></div>
      <div id="walls">${loadingHtml(wid === "mama" ? "Finding Mama's cassettes…" : "Dusting off the photo albums…")}</div>`;
    applyVars(); bobJar();
    const q = $("#q");
    q.addEventListener("input", () => renderSearch(q.value, list));
    loadMedia().then(() => {
      const walls = $("#walls"); if (!walls) return;
      walls.innerHTML = single
        ? `<h2 class="section-title"><span>${cats[0].emoji}</span> ${esc(cats[0].name)} <small>${list.length}</small></h2>
           <div class="wall">${list.map(it => polaroid(it, it.idx)).join("")}</div>`
        : cats.map(c => {
          const l = ITEMS.filter(it => it.cat === c.id);
          return `<h2 class="section-title"><span>${c.emoji}</span> ${esc(c.name)} <small>${l.length}</small>
            <a class="more btn btn-ghost" href="#/c/${c.id}">Open box →</a></h2>
            <div class="wall">${l.slice(0, 5).map(it => polaroid(it, it.idx)).join("")}</div>`;
        }).join("");
      applyVars(walls);
    }).catch(e => { const w2 = $("#walls"); if (w2) w2.innerHTML = errorHtml(e); });
  }
  function renderSearch(text, pool = ITEMS) {
    const box = $("#results"); if (!box) return;
    const t = text.trim().toLowerCase();
    if (!t) { box.innerHTML = ""; return; }
    const hits = pool.filter(it => (it.title + " " + it.caption + " " + CATS[it.cat].name + " " + (it.when || "") + " " + sharedText(it)).toLowerCase().includes(t));
    box.innerHTML = `<h2 class="section-title">🔎 “${esc(text)}” <small>${hits.length} found</small></h2>` +
      (hits.length ? `<div class="wall">${hits.map(it => polaroid(it, it.idx)).join("")}</div>` : `<p class="empty">No memories match that… yet! 🙈</p>`);
    applyVars(box);
  }

  function viewCategory(id) {
    const c = CATS[id]; if (!c) return viewLanding();
    const w = WORLD_OF[id];
    if (w.cats.length === 1) return viewWorld(w.id);
    setTitle(c.name);
    const list = ITEMS.filter(it => it.cat === id);
    app.innerHTML = `
      <div class="crumbs"><a class="chip" href="#/">🏠 Home</a><a class="chip" href="#/${w.id}" data-c="${w.color}">${w.emoji} ${esc(w.name)}</a></div>
      <h1 class="section-title flush"><span class="big">${c.emoji}</span> ${esc(c.name)}</h1>
      <p>${esc(c.blurb)} <b>${list.length}</b> ${["tapes", "mama"].includes(id) ? "tapes" : "clips"} inside.</p>
      <div class="tools"><button class="btn btn-sun" type="button" data-act="play-cat" data-cat="${id}">▶ Play this box from the start</button></div>
      <div id="wall">${loadingHtml("Opening the box…")}</div>`;
    loadMedia().then(() => {
      const w = $("#wall"); if (!w) return;
      w.innerHTML = `<div class="wall">${list.map(it => polaroid(it, it.idx)).join("")}</div>`;
      applyVars(w);
    }).catch(e => { const w = $("#wall"); if (w) w.innerHTML = errorHtml(e); });
    if (id === "birthday") setTimeout(() => confetti(90), 250);
  }

  function viewFavourites() {
    setTitle("Favourites");
    const list = ITEMS.filter(it => favs.has(it.slug));
    app.innerHTML = `
      <div class="crumbs"><a class="chip" href="#/">🏠 Home</a></div>
      <h1 class="section-title flush">💖 Favourites</h1>
      <p>Tap the heart on any memory to keep it here (saved in this browser only).</p>
      <div id="wall">${list.length ? loadingHtml("Fetching your favourites…") : `<p class="empty">No favourites yet. Go find one! 🕵️‍♀️</p>`}</div>`;
    if (!list.length) return;
    loadMedia().then(() => {
      const w = $("#wall"); if (!w) return;
      w.innerHTML = `<div class="wall">${list.map(it => polaroid(it, it.idx)).join("")}</div>`; applyVars(w);
    }).catch(e => { const w = $("#wall"); if (w) w.innerHTML = errorHtml(e); });
  }

  function neighbours(it) {
    const list = ITEMS.filter(x => x.cat === it.cat);
    const k = list.indexOf(it);
    return { prev: list[(k - 1 + list.length) % list.length], next: list[(k + 1) % list.length], pos: k + 1, total: list.length };
  }

  async function viewMemory(slug) {
    const it = BY_SLUG[slug]; if (!it) return viewLanding();
    const c = CATS[it.cat], w = WORLD_OF[it.cat];
    const { prev, next, pos, total } = neighbours(it);
    setTitle(it.title);
    const isFav = favs.has(it.slug);
    const stage = it.kind === "image"
      ? `<figure class="frame" id="mediaSlot">${loadingHtml("Unfolding the paper…")}</figure>`
      : it.kind === "audio"
      ? `<div class="cassette" id="deck">
           <div class="label"><div class="t">${it.emoji} ${esc(it.title)}</div><div>Side A · ${esc(c.name)}</div>
             <div class="window"><span class="reel"></span><span class="reel"></span></div></div>
           <div class="bottom"></div>
         </div>
         <div class="player-row"><button class="bigplay" id="bigplay" type="button" aria-label="Play">▶</button>
           <div id="mediaSlot" class="audio-slot">${loadingHtml("Rewinding the tape…")}</div></div>`
      : `<div class="tv"><div class="antenna"></div><div class="screen" id="mediaSlot">${loadingHtml("Warming up the telly…")}</div></div>`;
    app.innerHTML = `
      <div class="crumbs">
        <a class="chip" href="#/">🏠 Home</a>
        <a class="chip" href="#/${w.id}" data-c="${w.color}">${w.emoji} ${esc(w.name)}</a>
        ${w.cats.length > 1 ? `<a class="chip" href="${catHref(c.id)}" data-c="${c.color}">${c.emoji} ${esc(c.name)}</a>` : ""}
        <span class="chip">${pos} of ${total}</span>
      </div>
      <div class="memory">
        <div>
          <h1><span class="big-emo">${it.emoji}</span> ${esc(it.title)}</h1>
          ${stage}
        </div>
        <aside class="side">
          <div class="note">
            <p>${esc(it.caption)}</p>
            ${it.when ? `<span class="stamp">📅 Recorded ${esc(it.when)}</span><br>` : ""}
            ${it.shared ? `<p class="shared-line">📮 ${it.kind === "video" ? "Shared on" : "Added to"} ${esc(it.sharedVia)}<br><b>${esc(sharedText(it))}</b>${it.sharedPrecision === "month" ? "" : " <small>(NZ time)</small>"}</p>` : ""}
            <span class="stamp">${it.kind === "audio" ? "🎙️ VOICE TAPE" : it.kind === "image" ? "🖼️ KEEPSAKE" : "🎬 HOME VIDEO"}</span>
          </div>
          <div class="tools">
            <button class="btn" type="button" data-act="fav" aria-pressed="${isFav}">${isFav ? "💖 Loved" : "🤍 Love it"}</button>
            <button class="btn btn-sky" type="button" data-act="copy">🔗 Copy link</button>
            <button class="btn btn-sun" type="button" data-act="shuffle">🎲 Surprise me</button>
            ${it.kind === "image" ? `<button class="btn btn-mint" type="button" data-act="print" title="Print this one for the fridge">🖨️ Print it!</button>` : ""}
          </div>
          <label class="autoplay"><input type="checkbox" id="autoNext" ${store.get("autoNext", false) ? "checked" : ""}> Keep playing the next memory</label>
          <div class="navpair">
            <a class="navcard" href="#/m/${prev.slug}"><small>◀ Previous</small><span>${prev.emoji} ${esc(prev.title)}</span></a>
            <a class="navcard next" href="#/m/${next.slug}"><small>Next ▶</small><span>${next.emoji} ${esc(next.title)}</span></a>
          </div>
          <p id="spLink"></p>
        </aside>
      </div>`;
    applyVars();
    if (it.cat === "birthday" || /birthday|hbd/i.test(it.title)) setTimeout(() => confetti(), 300);
    $("#autoNext").addEventListener("change", e => store.set("autoNext", e.target.checked));

    try {
      await loadMedia();
      let m = mediaFor(it);
      if (!m) throw new Error(`Couldn't find “${it.file}” in the SharePoint ${it.folder} folder.`);
      if (!m.url) { await loadMedia(true); m = mediaFor(it); }
      if (BY_SLUG[slug] !== it || !$("#mediaSlot")) return; // navigated away
      const slot = $("#mediaSlot");
      if (it.kind === "image") {
        const img = document.createElement("img");
        img.src = m.url; img.alt = it.title; img.className = "frame-img";
        img.addEventListener("click", () => lightbox(m.url, it.title));
        slot.replaceChildren(img);
        const hint = document.createElement("figcaption");
        hint.className = "frame-hint"; hint.textContent = "Tap the picture to open it big (then ➕ to zoom in)";
        slot.appendChild(hint);
        const sheet = document.createElement("figcaption"); // only shows on paper
        sheet.className = "print-only";
        sheet.textContent = `${it.emoji} ${it.title}${it.when ? " · " + it.when : ""} · Papa & Mama Memories`;
        slot.appendChild(sheet);
        $("#spLink").innerHTML = m.webUrl && isOwner() ? `<a href="${esc(m.webUrl)}" target="_blank" rel="noopener noreferrer">📁 Open original in SharePoint</a>` : "";
        return;
      }
      const el = document.createElement(it.kind === "audio" ? "audio" : "video");
      el.setAttribute("playsinline", ""); el.setAttribute("controlslist", "nodownload");
      if (it.kind === "video") {
        // Uniform start for every video: our own big button; native controls appear once playback starts.
        // preload="none" stops old (non-streaming) MP4s from sitting on a stuck, button-less frame.
        el.controls = false; el.preload = "none"; el.src = m.url;
        if (m.thumb) el.poster = m.thumb;
        const cover = document.createElement("div");
        cover.className = "tv-cover" + (m.thumb ? " has-thumb" : "");
        cover.innerHTML = `<span class="tv-emo" aria-hidden="true">${it.emoji}</span>
          <button class="tv-play" id="bigplay" type="button" aria-label="Play video">▶</button>
          <span class="tv-hint">Press play!</span>`;
        const busy = document.createElement("div");
        busy.className = "tv-busy"; busy.hidden = true; busy.innerHTML = `<span class="spinner">🌀</span> Loading…`;
        slot.classList.add("has-video");
        slot.replaceChildren(el, cover, busy);
      } else {
        el.controls = true; el.preload = "metadata"; el.src = m.url;
        slot.replaceChildren(el);
      }
      $("#spLink").innerHTML = m.webUrl && isOwner() ? `<a href="${esc(m.webUrl)}" target="_blank" rel="noopener noreferrer">📁 Open original in SharePoint</a>` : "";
      wirePlayer(el, it, next);
      if (store.get("autoNext", false) && sessionStorage.getItem("pm:autostart") === "1") {
        sessionStorage.removeItem("pm:autostart");
        el.play().catch(() => { /* browser may block autoplay with sound */ });
      }
    } catch (e) {
      const slot = $("#mediaSlot"); if (slot) slot.innerHTML = errorHtml(e);
    }
  }

  /* ---------- big-picture viewer (keepsakes) ---------- */
  function lightbox(src, title) {
    const box = document.createElement("div");
    box.className = "lightbox";
    box.innerHTML = `<div class="lb-bar">
        <button class="btn" type="button" data-z="-" aria-label="Smaller">➖</button>
        <span class="lb-pct">100%</span>
        <button class="btn" type="button" data-z="+" aria-label="Bigger">➕</button>
        <button class="btn btn-pink" type="button" data-z="x">✕ Close</button>
      </div><div class="lb-scroll"><img alt=""></div>`;
    const img = box.querySelector("img"), pct = box.querySelector(".lb-pct");
    img.src = src; img.alt = title;
    let z = 1;
    const apply = () => { img.style.width = (z * 100) + "%"; pct.textContent = Math.round(z * 100) + "%"; };
    const zoom = d => { z = Math.min(6, Math.max(1, Math.round((z + d) * 2) / 2)); apply(); };
    const key = e => {
      if (e.key === "Escape") close();
      else if (e.key === "+" || e.key === "=") zoom(0.5);
      else if (e.key === "-" || e.key === "_") zoom(-0.5);
    };
    function close() { box.remove(); document.body.classList.remove("lb-open"); removeEventListener("keydown", key); }
    box.addEventListener("click", e => {
      const b = e.target.closest("[data-z]");
      if (b) { if (b.dataset.z === "x") close(); else zoom(b.dataset.z === "+" ? 0.5 : -0.5); return; }
      if (e.target === img) { z = z >= 2.5 ? 1 : z + 1; apply(); return; } // tap the picture: bigger, then back
      close(); // tap the dark space
    });
    addEventListener("keydown", key);
    document.body.appendChild(box); document.body.classList.add("lb-open"); apply();
  }

  function wirePlayer(el, it, next) {
    const deck = $("#deck"), big = $("#bigplay");
    const isVideo = el.tagName === "VIDEO";
    const cover = isVideo ? el.parentElement.querySelector(".tv-cover") : null;
    const busy = isVideo ? el.parentElement.querySelector(".tv-busy") : null;
    const sync = () => {
      const on = !el.paused && !el.ended;
      deck?.classList.toggle("playing", on);
      if (isVideo) {
        if (on) { cover.hidden = true; el.controls = true; }
        if (el.ended) { cover.hidden = false; cover.querySelector(".tv-hint").textContent = "Watch again!"; el.controls = false; }
      } else if (big) { big.textContent = on ? "⏸" : "▶"; big.setAttribute("aria-label", on ? "Pause" : "Play"); }
    };
    ["play", "pause", "ended"].forEach(ev => el.addEventListener(ev, sync));
    if (isVideo) cover.addEventListener("click", e => { if (e.target === cover || !e.target.closest("button")) big?.click(); });
    if (busy) {
      el.addEventListener("waiting", () => { busy.hidden = false; });
      ["playing", "pause", "ended", "error"].forEach(ev => el.addEventListener(ev, () => { busy.hidden = true; }));
    }
    // Rewind for replay. SharePoint download URLs may not be seekable, so fall back to reloading the source.
    const rewind = () => {
      const canSeek = el.seekable && el.seekable.length > 0 && el.seekable.start(0) <= 0.1;
      if (canSeek) { try { el.currentTime = 0; return; } catch { /* fall through */ } }
      el.load();
    };
    const playFromStart = () => { if (el.ended || (el.duration && el.currentTime >= el.duration - 0.05)) rewind(); return el.play(); };
    big?.addEventListener("click", () => {
      if (!el.paused) { el.pause(); return; }
      if (isVideo) { cover.hidden = true; busy.hidden = false; el.controls = true; }
      playFromStart().catch(async err => {
        if (isVideo) { busy.hidden = true; cover.hidden = false; }
        let why = err?.name || "error";
        try {
          const r = await fetch(el.currentSrc || el.src, { headers: { Range: "bytes=0-1" }, cache: "no-store" });
          why = `${why} · server ${r.status}`;
          if (r.status === 403) { await loadMedia(true).catch(() => {}); const m = mediaFor(it); if (m?.url) el.src = m.url; why += " · refreshed link, tap ▶ again"; }
        } catch (e) { why = `${why} · network`; }
        toast(`Couldn't start this one (${why}).`);
        console.warn(err);
      });
    });
    let retried = false;
    el.addEventListener("playing", () => { retried = false; });
    el.addEventListener("error", async () => {
      if (FAMILY) {
        if (retried) return; retried = true;
        const t = el.currentTime;
        try { await loadMedia(true); const m = mediaFor(it); if (m?.url) { el.src = m.url; el.currentTime = t; } }
        catch { location.reload(); }
        return;
      }
      if (retried) return; retried = true; // download URL may have expired: refresh once
      const t = el.currentTime;
      try { await loadMedia(true); const m = mediaFor(it); if (m?.url) { el.src = m.url; el.currentTime = t; } } catch { /* shown by player */ }
    });
    el.addEventListener("ended", () => {
      if (store.get("autoNext", false)) {
        sessionStorage.setItem("pm:autostart", "1");
        toast(`Up next: ${next.emoji} ${next.title}`);
        setTimeout(() => { location.hash = `#/m/${next.slug}`; }, 1200);
      } else {
        rewind(); // native play button (and ours) now starts again from the beginning
        if (it.cat === "birthday") confetti(80);
      }
    });
    currentPlayer = el;
  }
  let currentPlayer = null;

  /* ---------- router ---------- */
  function route() {
    currentPlayer?.pause?.(); currentPlayer = null;
    const h = location.hash.replace(/^#\/?/, "");
    const [kind, arg] = h.split("/");
    if (kind === "m" && arg) viewMemory(decodeURIComponent(arg));
    else if (kind === "c" && arg) viewCategory(arg);
    else if (kind === "favourites") viewFavourites();
    else if (kind === "new") viewNew();
    else if (WORLDS[kind]) viewWorld(kind);
    else viewLanding();
    // The music box plays while browsing; it fades out the moment a clip's own page opens.
    if (kind === "m") window.PM_MUSIC?.stop(); else window.PM_MUSIC?.play(); // quiet only where a clip plays
    scrollTo(0, 0);
    app.focus({ preventScroll: true });
  }
  function currentWorld() {
    const [kind, arg] = location.hash.replace(/^#\/?/, "").split("/");
    if (WORLDS[kind]) return WORLDS[kind];
    if (kind === "c" && CATS[arg]) return WORLD_OF[arg];
    if (kind === "m" && BY_SLUG[decodeURIComponent(arg || "")]) return WORLD_OF[BY_SLUG[decodeURIComponent(arg)].cat];
    return null;
  }
  function shuffle() {
    const w = currentWorld();
    const pool = w ? worldItems(w) : ITEMS;
    const cur = location.hash.split("/")[2];
    let pick; do { pick = pool[(Math.random() * pool.length) | 0]; } while (pool.length > 1 && pick.slug === cur);
    toast(`🎲 ${pick.emoji} ${pick.title}`);
    location.hash = `#/m/${pick.slug}`;
  }

  /* ---------- global events ---------- */
  document.addEventListener("click", async e => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const act = b.dataset.act;
    if (act === "shuffle") shuffle();
    else if (act === "retry") { await loadMedia(true).catch(() => {}); route(); }
    else if (act === "play-cat") { const first = ITEMS.find(i => i.cat === b.dataset.cat); store.set("autoNext", true); sessionStorage.setItem("pm:autostart", "1"); location.hash = `#/m/${first.slug}`; }
    else if (act === "fav") {
      const slug = location.hash.split("/")[2];
      if (favs.has(slug)) { favs.delete(slug); toast("Removed from favourites"); }
      else { favs.add(slug); toast("💖 Added to favourites!"); confetti(60); }
      saveFavs();
      const on = favs.has(slug); b.setAttribute("aria-pressed", on); b.textContent = on ? "💖 Loved" : "🤍 Love it";
    } else if (act === "print") {
      toast("🖨️ Sending it to the printer…");
      setTimeout(() => print(), 250);
    } else if (act === "copy") {
      try { await navigator.clipboard.writeText(location.href); toast("🔗 Link copied!"); } catch { toast("Couldn't copy. Use the address bar."); }
    }
  });
  document.addEventListener("keydown", e => {
    if (e.target.closest("input, textarea, audio, video")) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const slug = location.hash.startsWith("#/m/") ? location.hash.split("/")[2] : null;
    if (e.key === "r" || e.key === "R") shuffle();
    else if (slug && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
      const n = neighbours(BY_SLUG[slug]); location.hash = `#/m/${(e.key === "ArrowRight" ? n.next : n.prev).slug}`;
    } else if (slug && e.key === " " && currentPlayer) { e.preventDefault(); currentPlayer.paused ? currentPlayer.play() : currentPlayer.pause(); }
  });
  $("#shuffleBtn").addEventListener("click", () => shuffle());

  function showApp() {
    $("#topbar").hidden = false; $("#foot").hidden = false;
    const n = f => ITEMS.filter(f).length;
    $("#footCount").textContent = `${n(i => i.cat === "tapes")} voice tapes, ${n(i => i.cat === "mama")} Mama's tapes & ${n(i => i.kind === "video")} home videos`;
    saveFavs();
    addEventListener("hashchange", route);
    route();
  }

  /* ---------- sign-out: always end on our own "see you soon" page ---------- */
  async function familySignOut() {
    // Same-origin logout clears this site's Access cookie and revokes the Access session (all apps).
    try { await fetch("/cdn-cgi/access/logout", { credentials: "same-origin", cache: "no-store" }); } catch { /* still leave */ }
    location.replace("/bye/family/");
  }
  document.addEventListener("click", e => { if (e.target.closest('[data-act="signout"]')) FAMILY ? familySignOut() : $("#signOutBtn").click(); });

  // Lets the site be added to a phone's home screen and opened when the network is patchy.
  if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));

  /* ---------- boot ---------- */
  async function familyBoot() {
    const card = $(".gate-card");
    $("#signOutBtn").addEventListener("click", familySignOut);
    let me;
    try {
      const r = await fetch("/api/family/me", { cache: "no-store", credentials: "same-origin" });
      if (!r.ok) throw new Error(String(r.status));
      me = await r.json();
      sessionStorage.removeItem("pm:reauth");
    } catch (e) {
      // Usually an expired Cloudflare Access session: reload once to sign in again.
      const tries = +(sessionStorage.getItem("pm:reauth") || 0);
      if (tries < 2) { sessionStorage.setItem("pm:reauth", tries + 1); location.reload(); return; }
      card.innerHTML = `<h1 class="hand">Hmm… 🤔</h1><p class="gate-sub">We couldn't check your sign-in. Please try again later.</p>
        <button class="btn btn-pink" type="button" data-act="signout">Sign in again</button>`;
      return;
    }
    const who = `<p class="gate-note">Signed in as <b>${esc(me.email)}</b> · <button class="linkish" type="button" data-act="signout">not you?</button></p>`;
    if (me.status === "approved") { setWho(me.name); showApp(); setTimeout(() => confetti(70), 400); return; }
    if (me.status === "pending") {
      card.innerHTML = `<div class="big-emoji" aria-hidden="true">💌</div><h1 class="hand">Request sent!</h1>
        <p class="gate-sub">Dada has your request${me.name ? `, ${esc(me.name)}` : ""}. As soon as he says yes, the memory box will open for you.</p>
        <button class="btn btn-sun btn-big" type="button" id="checkAgain">🔄 Check again</button>${who}`;
      $("#checkAgain").addEventListener("click", () => location.reload());
      return;
    }
    if (me.status === "denied") {
      card.innerHTML = `<div class="big-emoji" aria-hidden="true">🔒</div><h1 class="hand">Sorry!</h1>
        <p class="gate-sub">This memory box isn't open for this account. Please speak to Dada.</p>${who}`;
      return;
    }
    card.innerHTML = `<div class="big-emoji" aria-hidden="true">🎁</div><h1 class="hand">Knock knock!</h1>
      <p class="gate-sub">This is a private family memory box. Tell Dada who you are and he'll let you in.</p>
      <form id="reqForm" class="req-form">
        <label>Your name<input name="name" required maxlength="60" autocomplete="name" placeholder="e.g. Amma"></label>
        <label>A note for Dada <small>(optional)</small><textarea name="note" maxlength="200" rows="3" placeholder="e.g. It's me, from Chennai!"></textarea></label>
        ${CFG.turnstileSiteKey ? `<div id="humanCheck" class="human-check" aria-label="Human check"></div>` : ""}
        <button class="btn btn-pink btn-big" type="submit">💌 Ask Dada to let me in</button>
        <p class="gate-status" id="reqStatus" role="status"></p>
      </form>${who}`;
    let widgetId = null;
    if (CFG.turnstileSiteKey) {
      window.onTurnstileReady = () => {
        widgetId = window.turnstile.render("#humanCheck", { sitekey: CFG.turnstileSiteKey, theme: "light", size: "flexible" });
      };
      const sc = document.createElement("script");
      sc.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileReady";
      sc.async = true; sc.defer = true;
      document.head.appendChild(sc);
    }
    $("#reqForm").addEventListener("submit", async e => {
      e.preventDefault();
      const f = new FormData(e.target), st = $("#reqStatus");
      const human = CFG.turnstileSiteKey && window.turnstile && widgetId !== null ? window.turnstile.getResponse(widgetId) : "";
      if (CFG.turnstileSiteKey && !human) { st.textContent = "Please tick the “I'm human” box first 🙂"; return; }
      st.textContent = "Sending…";
      try {
        const r = await fetch("/api/family/request", { method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: f.get("name"), note: f.get("note"), turnstile: human }) });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || r.status);
        location.reload();
      } catch (err) {
        st.textContent = "Couldn't send: " + (err.message || err);
        if (widgetId !== null) window.turnstile?.reset(widgetId);
      }
    });
  }

  (async () => {
    const status = $("#gateStatus");
    window.PM_MUSIC?.play(); // sign-in screen
    if (FAMILY) { await familyBoot(); return; }
    if (sessionStorage.getItem("pm:bye")) { sessionStorage.removeItem("pm:bye"); location.replace("/bye/"); return; }
    if (DEMO) { showApp(); return; }
    try {
      await initAuth();
    } catch (e) {
      status.textContent = "Sign-in hiccup: " + (e.message || e); return;
    }
    $("#signInBtn").addEventListener("click", () => {
      status.textContent = "Off to Microsoft to check it's you… 🔐";
      msal.loginRedirect({ scopes: CFG.scopes, prompt: "select_account" }).catch(e => status.textContent = e.message);
    });
    $("#signOutBtn").addEventListener("click", () => {
      // Full Microsoft sign-out (safe on shared computers), then back here and on to the "see you soon" page.
      sessionStorage.setItem("pm:bye", "1");
      msal.logoutRedirect({ account, postLogoutRedirectUri: location.origin + "/" });
    });
    if (account) {
      if (account.tenantId && account.tenantId !== CFG.tenantId) { status.textContent = "Please use your Septagon account."; return; }
      if (isOwner()) $("#adminLink").hidden = false;
      logSignIn();
      showApp();
      ensureToken().catch(() => {}); // also brings back Dada's chosen name for the greeting
      setTimeout(() => confetti(70), 400);
    }
  })();
})();
