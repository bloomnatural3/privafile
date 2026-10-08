# privafile — privacy-preserving analytics

Server-side page-view counting. **No client-side script at all.**

## Why not GA4 / Plausible / Cloudflare Web Analytics

All three run JavaScript in the visitor's browser and send data to a third
party. That is exactly the thing this site promises never happens, so we do
not use them — not even the "cookieless" ones, because cookieless still means
a request leaves the page.

## How this works instead

A Cloudflare Worker sits in front of the static site and counts the page
request the visitor was already making. The browser sends nothing extra.

**What gets stored:** a number, per day, per path. That is the entire schema.

**What is never stored:** IP addresses, cookies, user agents, referrers,
session identifiers, timings, geography.

Uniques are estimated by hashing IP + user agent together with the date and a
private salt, folding that into a small bucket, and recording only whether that
bucket was seen before — the hash inputs are discarded immediately. Because the
date is part of the hash, today's bucket cannot be linked to yesterday's.

Trade-off, stated plainly: counts are exact, uniques are approximate. That is
the deliberate price of not keeping identifiers.

## One-time setup

```bash
cd worker
npx wrangler login
npx wrangler kv namespace create PF_KV
# copy the printed id into wrangler.toml, replacing REPLACE_WITH_YOUR_KV_NAMESPACE_ID
npx wrangler secret put STATS_KEY      # invent a long random string, keep it safe
```

Then deploy. Because `wrangler.toml` points `assets.directory` at `../dist`,
run the site build first:

```bash
cd ..            # site/
node build.mjs   # writes dist/
cd worker
npx wrangler deploy
```

## Reading the numbers

```bash
curl "https://privafile.net/_stats?key=YOUR_STATS_KEY"
curl "https://privafile.net/_stats?key=YOUR_STATS_KEY&raw=1"
```

Returns page views per day, per path, and the estimated uniques. Without the
correct key the endpoint returns 404, so it stays invisible to visitors.

## Files

| File | Purpose |
|---|---|
| `index.js` | the Worker: counts, then serves the asset |
| `wrangler.toml` | bindings — KV namespace, assets directory |

## Skipped paths

Assets (`/src/*`, any file extension), `robots.txt`, `sitemap.xml`,
`favicon.svg` and `/_stats` are never counted, so the numbers reflect real
page views rather than asset noise.
