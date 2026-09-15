# Papa's Memories: family access (Gmail) with an approval gate

## How it works

| Who | Where | How they sign in | What protects the media |
|---|---|---|---|
| Siva, Smitha | `https://mem.ss3.dev/` | Microsoft (Septagon account, MSAL) | Their own SharePoint read permission (Graph, delegated) |
| Parents / family | `https://mem.ss3.dev/family/` | Cloudflare Access: email one-time PIN (optionally Google) | Dada's approval (Cloudflare KV) plus a server-side proxy |
| Siva only | `https://mem.ss3.dev/admin/` (Approvals + Sign-in log) | Cloudflare Access, policy = `s.subiah@septagon.com.au` | Owner check in every admin API call |

- **Sign-in and approval are separate.** Cloudflare Access proves who someone is (their email). The site then checks your approval list. New people see "Knock knock!", ask for access, and wait until you approve them.
- **Family members never see SharePoint.** Their audio and video stream through `/api/family/media/…`, a Cloudflare Function that fetches from SharePoint using an app-only Graph identity (Sites.Selected, read on this one site). No SharePoint URLs or headers reach their browser.
- **Every API call re-checks the Access token** (signature, audience, issuer, expiry) and the approval status. This also covers requests that arrive through `papas-memories.pages.dev`, which bypass Access.
- **Removing access takes effect on the very next request.**
- **Only you can see the control room.** Sign in either with your Microsoft account (the same sign-in as the memory box) or through the Cloudflare Access "Memories – Admin" app. Each admin API call checks that the verified email is `OWNER_EMAIL`; Smitha's account is refused.
- **The sign-in log records every visit** (at most one entry per person every 30 minutes; entries are kept for a year). It shows the time (Sydney), who, how they signed in, approximate city and country (from Cloudflare), and their current access. You and Smitha appear as **Dada** and **Mama** (`VISITOR_NAMES` in `wrangler.toml`); everyone else appears as their email, with a **Remove access** button. Microsoft sign-ins are only logged after the server verifies the Microsoft ID token.
- **Only allow-listed files can be served** (`functions/_lib/allow.js`, generated from `website/memories.js`).

---

## One-time setup

### 1. Entra ID: media proxy app (app-only, least privilege)

1. Create the app: **Entra admin centre → App registrations → New registration**
   - Name: `Papa's Memories Media Proxy`
   - Single tenant
   - No redirect URI
2. Add the permission: **API permissions → Add → Microsoft Graph → Application permissions → `Sites.Selected`**, then **Grant admin consent**.
3. Create the secret: **Certificates & secrets → New client secret** (e.g. 12 months). Copy the value. You'll paste it in step 3; don't save it anywhere else.
4. Give the app **read** access to the Papa's Memories site only. Use **one** of the two options below.
   - **Graph Explorer** (signed in as admin, needs `Sites.FullControl.All` consent):
     ```
     POST https://graph.microsoft.com/v1.0/sites/septagonconsulting.sharepoint.com,f54ba397-883c-40af-951a-b830f7b34ab6,a5754d2a-e568-4d82-8e46-38fdcd16af5e/permissions
     {
       "roles": ["read"],
       "grantedToIdentities": [{ "application": { "id": "<PROXY-CLIENT-ID>", "displayName": "Papa's Memories Media Proxy" } }]
     }
     ```
   - **PnP PowerShell:**
     ```powershell
     Grant-PnPAzureADAppSitePermission -AppId <PROXY-CLIENT-ID> -DisplayName "Papa's Memories Media Proxy" `
       -Site https://septagonconsulting.sharepoint.com/sites/PapasMemories -Permissions Read
     ```
5. Put the proxy's **Application (client) ID** into `wrangler.toml` as `GRAPH_CLIENT_ID`.

### 2. Cloudflare KV (the approval list)

```powershell
cd "C:\Users\sivas\OneDrive - Septagon Consulting (1)\Papa"
npx wrangler kv namespace create FAMILY
```

Copy the `id` it prints into `wrangler.toml`, under `[[kv_namespaces]]`.

### 3. Store the secret in Cloudflare

```powershell
npx wrangler pages secret put GRAPH_CLIENT_SECRET --project-name papas-memories
```

Paste the secret from step 1.3 when prompted.

### 4. Cloudflare Zero Trust (Access)

1. **Settings → Custom pages / General:** note your **team domain** (e.g. `yourteam.cloudflareaccess.com`). Put it in `wrangler.toml` as `TEAM_DOMAIN`.
2. **Settings → Authentication → Login methods:** make sure **One-time PIN** is on. Adding Google is optional (it needs a Google OAuth client).
3. **Access → Applications → Add → Self-hosted: "Memories – Family"**
   - Destinations: `mem.ss3.dev` path `family`, **and** `mem.ss3.dev` path `api/family`
   - Session duration: 30 days (older users stay signed in)
   - Policy **Allow**, Include **Everyone**. Approval happens in the site, not here.
   - Save, then copy the **Application Audience (AUD) tag** into `wrangler.toml` as `FAMILY_AUD`.
4. **Access → Applications → Add → Self-hosted: "Memories – Admin"**
   - Destinations: `mem.ss3.dev` path `admin`, **and** `mem.ss3.dev` path `api/admin`
   - Policy **Allow**, Include **Emails**: `s.subiah@septagon.com.au`
   - Copy its AUD tag into `wrangler.toml` as `ADMIN_AUD`.
5. Optional: to be pinged when someone asks for access, set `NOTIFY_WEBHOOK` in `wrangler.toml` (ntfy / Teams / n8n). The ping includes the requester's name, email and note.

### 5. Deploy (run from the Papa folder, so the Functions are included)

```powershell
cd "C:\Users\sivas\OneDrive - Septagon Consulting (1)\Papa"
npx wrangler pages deploy
```

### 6. Human check ("verify you're human")

**a) Challenge before the email-code screen** (no code; stops bots from spamming the sign-in page)
- Cloudflare dashboard → **ss3.dev** zone → **Security → Security rules** (or *WAF → Custom rules*) → **Create rule**
- Name: `Family human check`
- Expression: *Hostname* **equals** `mem.ss3.dev` **AND** *URI Path* **starts with** `/family`
- Action: **Managed Challenge** → **Deploy**

**b) Turnstile tick-box on the "Knock knock!" form** (checked on the server)
1. Cloudflare dashboard → **Turnstile** → **Add widget**: name `Papa's Memories`, hostname `mem.ss3.dev`, mode **Managed** → **Create**.
2. Copy the **Site key** (public) into `website/config.js` → `turnstileSiteKey: "..."`.
3. Store the **Secret key**: `npx wrangler pages secret put TURNSTILE_SECRET --project-name papas-memories`
4. Deploy. (The check is only enforced once `TURNSTILE_SECRET` exists; with no site key the form works without it.)

---

## Day to day

1. Send your parents **https://mem.ss3.dev/family/**.
2. They enter their Gmail address, type the 6-digit code Cloudflare emails them, then fill in "Knock knock!" with their name and a note.
3. You open **https://mem.ss3.dev/admin/** (the **Sign-in log** tab is at `/admin/#log`) (or the 🛂 **Approvals** button in the top bar when signed in with Microsoft) and click **Approve**.
4. They tap **Check again** and the memory box opens.
5. **Remove access** blocks them on their next request. **Forget** deletes their entry so they can ask again.
6. You can also pre-approve someone with **Let someone in straight away** before they visit.

## When adding new clips

Add them to `website/memories.js`, then run `python gen_allow.py` to refresh the proxy allow-list, then deploy.
