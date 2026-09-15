# Papa's Memories

A private, scrapbook-style website of our daughter's childhood voice clips and home videos, plus Mama's memory tapes.
It is served from Cloudflare Pages at **https://mem.ss3.dev**, and the media stays in a private SharePoint site.

| Who | Address | Sign-in |
|---|---|---|
| Dada, Mama | `https://mem.ss3.dev/` | Microsoft Entra ID (Septagon) |
| Family | `https://mem.ss3.dev/family/` | Cloudflare Access email PIN, then Dada's approval |
| Dada only | `https://mem.ss3.dev/admin/` | Approvals, sign-in log, 🩺 streaming check |

**Architecture and sequence diagrams:** open [`docs/architecture.html`](docs/architecture.html) in a browser.
**One-time setup and day-to-day running:** see [`SETUP-FAMILY-ACCESS.md`](SETUP-FAMILY-ACCESS.md).

## Layout

```
website/            static site (Cloudflare Pages output)
  index.html        memory box (Microsoft sign-in)
  family/           family entry (Cloudflare Access)
  admin/            Dada's control room
  app.js            player, routing, sign-in, signed media links
  admin.js          approvals, sign-in log, health check
  memories.js       generated: titles, captions, groups for 111 clips
  config.js         public IDs only (client ID, tenant, Turnstile site key)
  _headers          CSP, security headers, cache rules
functions/          Cloudflare Pages Functions
  _lib/access.js    Cloudflare Access JWT checks, owner guard
  _lib/msid.js      Microsoft ID token checks
  _lib/graph.js     app-only Graph (Sites.Selected), ranged streaming
  _lib/mediatoken.js  6-hour HMAC media links
  _lib/visits.js    sign-in log in KV
  _lib/allow.js     generated allow-list of streamable files
  api/family/       me, request (Turnstile)
  api/admin/        requests, decide, log, health
  api/ms/token.js   media link for Dada / Mama
  api/log/visit.js  Microsoft sign-in log
  api/stream/       /api/stream/<token>/<Folder>/<file>
tools/
  gen_memories.py   rebuilds website/memories.js from tools/clips.txt
  clips.txt         Folder | file | SharePoint unique ID
gen_allow.py        rebuilds functions/_lib/allow.js from memories.js
wrangler.toml       Pages project, public vars, KV binding (no secrets)
docs/               architecture page
```

## Deploy

```powershell
cd "C:\Users\sivas\OneDrive - Septagon Consulting (1)\Papa"
npx wrangler pages deploy
```

Run it from this folder so the Functions are included.

## Adding or renaming clips

1. Put the file in the SharePoint site (`Documents/Audio`, `Video` or `Mama`).
2. Edit titles and captions in `tools/gen_memories.py`, and add the file to `tools/clips.txt`.
3. Rebuild and deploy:
   ```powershell
   python tools\gen_memories.py
   python gen_allow.py
   npx wrangler pages deploy
   ```

## Secrets (never in git)

| Name | Where | Rotate |
|---|---|---|
| `GRAPH_CLIENT_SECRET` | Cloudflare Pages → Variables and Secrets (Production) | Entra → *Papa's Memories Media Proxy* → Certificates & secrets. Expires about Sept 2027; 🩺 check shows `AADSTS7000222` when expired. |
| `TURNSTILE_SECRET` | Cloudflare Pages → Variables and Secrets (Production) | Cloudflare → Turnstile → widget → Rotate secret |

## Key identifiers (not secret)

- Entra tenant: `28f3df7e-b260-48f9-9c0b-6e5bc1c9b7b4`
- SPA app (sign-in): `e14e65e9-38ff-47d0-8692-86c6cca7c6b2`
- Media Proxy app (Sites.Selected read): `dbc728a8-0a6f-4bd8-b42d-bc173109743d`
- SharePoint site: `https://septagonconsulting.sharepoint.com/sites/PapasMemories`
- Cloudflare Access team: `septagon-security.cloudflareaccess.com`
- Access app: *Memories – Family* (paths `family`, `api/family`)
- WAF rule: *Human Verification* (mem.ss3.dev, excluding `/api/` and `/cdn-cgi/`)
- KV namespace: `FAMILY`
