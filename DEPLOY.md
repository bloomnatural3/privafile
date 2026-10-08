# privafile.net — DEPLOYMENT & ANALYTICS SETUP

Everything you need to do, in order. Nothing here costs money except the domain.

---

## ✅ Already done

- Domain `privafile.net` registered, nameservers on Cloudflare, zone **Active**
- GitHub repo `bloomnatural3/privafile` with auto-deploy
- Cloudflare Pages building `node build.mjs` → `dist`
- 21 tools live, `https://privafile.net` serving correctly

---

## TASK 1 — Confirm Cloudflare Web Analytics is OFF

**Why:** Cloudflare auto-enabled it. It injects `cloudflareinsights.com/beacon.min.js`
and POSTs to `/cdn-cgi/rum`, which is third-party tracking and contradicts the
site's promise. I verified it was gone once; confirm it stays gone.

**Steps**
1. dash.cloudflare.com → `privafile.net` → **Analytics & Logs** → **Web Analytics**
2. If a `privafile.net` entry exists → **⋯** → **Disable** (or delete it)
3. **Speed** → **Optimization** → **Content Optimization** → **Rocket Loader** = **Off**
4. **Caching** → **Configuration** → **Purge Everything**

**Verify:** open `https://privafile.net/privacy/` and use a tool below it.
`External requests` must read **0**.

---

## TASK 2 — Deploy the server-side counter (optional but recommended)

This gives you real traffic numbers **without** a client-side script.

### 2a. Install and log in
```bash
cd "/mnt/c/Users/alaa0/Documents/business/ALAA02/tool-engine/site/worker"
npx wrangler login
```

### 2b. Create the KV store
```bash
npx wrangler kv namespace create PF_KV
```
It prints something like:
```
[[kv_namespaces]]
binding = "PF_KV"
id = "a1b2c3d4e5f6..."
```
Copy that `id` into `wrangler.toml`, replacing
`REPLACE_WITH_YOUR_KV_NAMESPACE_ID`.

### 2c. Set the secret key
```bash
npx wrangler secret put STATS_KEY
```
Type a long random string when prompted. **Save it** — you need it to read stats.
Generate one with:
```bash
openssl rand -hex 32
```

### 2d. Build and deploy
```bash
cd ..                  # back to site/
node build.mjs         # writes dist/
cd worker
npx wrangler deploy
```

### 2e. Read your numbers
```bash
curl "https://privafile.net/_stats?key=YOUR_STATS_KEY"
```
Returns page views per day and per path, plus estimated uniques.

---

## ⚠️ Important: Worker vs Pages routing

You now have **two** ways the site could serve:

- **Cloudflare Pages** (current) — simple, already working
- **Worker + assets** (with the counter) — adds analytics

**Do not run both on the same domain.** If you deploy the Worker, it takes over
serving `privafile.net` and Pages should be detached from the custom domain
(or left as the `*.pages.dev` preview only).

**If this feels like too much moving parts right now:** skip Task 2 entirely.
The site works fine without it. You just won't have traffic numbers yet. The
brief's month-4 gate needs data, but that gate is months away.

---

## TASK 3 — Google Search Console

**Why:** this is how you find out whether anyone finds the site, and it's
required by the brief's month-4 gate (≥15k impressions, ≥1k clicks).

### 3a. Create the account
```
https://accounts.google.com/signup
```

### 3b. Add the property
```
https://search.google.com/search-console
```
→ **Add property** → **Domain** → enter `privafile.net`

### 3c. Verify via DNS (easiest, since DNS is already on Cloudflare)
Search Console gives you a **TXT record** value. Then:
1. Cloudflare → `privafile.net` → **DNS** → **Add record**
2. Type: `TXT` · Name: `@` · Content: paste the value
3. TTL: Auto · Proxy: n/a for TXT
4. Save → back in Search Console → **Verify**

### 3d. Submit the sitemap
```
https://search.google.com/search-console/sitemaps
```
→ enter `sitemap.xml` → **Submit**

24 URLs are already in it.

---

## TASK 4 — Housekeeping

- **Delete** `C:\Users\alaa0\Documents\business\github_pat_1.txt` — a raw GitHub
  token in plain text. Redundant; the working copy is `GITHUB_TOKEN` in `~/.bashrc`.
- **Decide on HEIC** (`ESC-003`) — LGPL licence question, blocks iPhone photo tools
- **Decide on audio/video** (`ESC-004`) — ffmpeg licence unresolved, recommend deferring

---

## ⚠️ Velocity cap — currently exceeded

The brief allows **≤7 new indexable pages per week** in months 1–3.
We published **24 pages in week 1**.

That is over the cap the brief set, and the reason for the cap is sound: a large
set of thin pages appearing at once can read as bulk content to a search engine.

**Recommendation: publish nothing new for now.** Let this set get indexed and
see what Search Console reports. Then add the next batch, roughly 7 per week.

---

## Status of the brief's gates

| Gate | Threshold | Status |
|---|---|---|
| Month 4 | ≥25 tools · ≥80% indexed · ≥15k impressions · ≥1k clicks | clock starts when indexed → ~Feb 2027 |
| Month 6 | <3k visitors → escalate | not started |
| Rolling | traffic −30% for 2 weeks → stop publishing | not started |

**Honest position:** the tools work and the privacy claim is verified. What is
completely unproven is whether anyone will find or use the site. The SERP study
suggests weak incumbents for OCR, HEIC and PNG/WebP conversion — but that is a
hypothesis until Search Console shows impressions.
