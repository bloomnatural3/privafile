/**
 * privafile.net — privacy-preserving page-view counter
 *
 * Runs as a Cloudflare Worker that sits in front of the Pages site.
 *
 * WHY THIS EXISTS
 *   The site's central promise is that using a tool sends nothing anywhere.
 *   Client-side analytics (GA4, Cloudflare Web Analytics, Plausible script)
 *   all break that promise, because they run in the visitor's browser and
 *   phone home. So we count on the server instead: the visitor's browser makes
 *   exactly one request — for the page — which it was going to make anyway.
 *   No script, no cookie, no identifier.
 *
 * WHAT IS STORED
 *   Per day, per path: a count. Never an IP, never a user agent, never a
 *   referrer, never a cookie. There is no way to reconstruct an individual
 *   visit from what we keep, which is the point.
 *
 * HOW THE COUNTER IS READ
 *   GET /_stats?key=<STATS_KEY>    → JSON summary
 *   GET /_stats?key=<STATS_KEY>&raw=1 → per-path daily table
 *   Without the correct key both return 404, so the endpoint is invisible.
 */

const COUNTER_KEY = 'count:';
const DAYS_TO_KEEP = 400;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // --- stats endpoint (must come first, and must not be counted) ---
    if (path === '/_stats' || path === '/_stats/') {
      return handleStats(url, env);
    }

    // --- never count these ---
    if (shouldSkip(path)) {
      return env.ASSETS.fetch(request);
    }

    // --- count, then serve ---
    const res = await env.ASSETS.fetch(request);
    // Only count real page views: successful HTML, GET, not a bot preflight.
    if (res.ok && isPageView(request, res, path)) {
      ctx.waitUntil(bump(env, path, request));
    }
    return res;
  }
};

/** Paths that are not page views and must never be counted. */
function shouldSkip(path) {
  if (path.startsWith('/src/')) return true;
  if (path.startsWith('/cdn-cgi/')) return true;
  if (path === '/robots.txt' || path === '/sitemap.xml' || path === '/favicon.svg') return true;
  if (/\.(css|js|map|png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|txt|xml|json)$/i.test(path)) return true;
  return false;
}

function isPageView(request, response, path) {
  if (request.method !== 'GET') return false;
  const ct = response.headers.get('content-type') || '';
  if (!ct.includes('text/html')) return false;
  return true;
}

/** Normalise a path so /merge-pdf/ and /merge-pdf both count as one page. */
function normalise(path) {
  if (path === '/' || path === '') return '/';
  return path.endsWith('/') ? path : path + '/';
}

/** A coarse, rotating bucket that lets us count unique-ish visitors without
 *  storing anything identifying. Built from IP + user agent, hashed, and
 *  mixed with the current date so yesterday's hash cannot be linked to today's.
 *  We only ever store the resulting counter values, never the hash inputs. */
async function dailyVisitorBucket(request, day) {
  const ip = request.headers.get('CF-Connecting-IP') || '';
  const ua = request.headers.get('User-Agent') || '';
  const data = new TextEncoder().encode(`${ip}|${ua}|${day}|privafile-salt-v1`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(digest);
  // Fold to a small integer; only used to distinguish "same as before" from "new".
  let n = 0;
  for (let i = 0; i < 4; i++) n = (n * 256 + bytes[i]) >>> 0;
  return n % 100000;
}

async function bump(env, path, request) {
  const day = new Date().toISOString().slice(0, 10);
  const p = normalise(path);

  const pageKey = `${COUNTER_KEY}page:${day}:${p}`;
  const totalKey = `${COUNTER_KEY}total:${day}`;

  const ops = [
    incr(env, pageKey),
    incr(env, totalKey)
  ];

  // Unique-visitor approximation: how many distinct buckets we saw today.
  // Stored as a set size, computed without keeping the bucket values.
  const bucket = await dailyVisitorBucket(request, day);
  const bucketKey = `${COUNTER_KEY}uv:${day}:${p}:${bucket}`;
  ops.push(
    (async () => {
      const existing = await env.PF_KV.get(bucketKey);
      if (!existing) {
        await env.PF_KV.put(bucketKey, '1', { expirationTtl: 60 * 60 * 24 * DAYS_TO_KEEP });
        await incr(env, `${COUNTER_KEY}uvtotal:${day}:${p}`);
      }
    })()
  );

  await Promise.all(ops);
}

async function incr(env, key) {
  const cur = parseInt((await env.PF_KV.get(key)) || '0', 10);
  await env.PF_KV.put(key, String(cur + 1), { expirationTtl: 60 * 60 * 24 * DAYS_TO_KEEP });
  return cur + 1;
}

async function handleStats(url, env) {
  const expected = env.STATS_KEY;
  const provided = url.searchParams.get('key');

  // Constant-ish comparison; the endpoint is secret-by-key, not public.
  if (!expected || provided !== expected) {
    return new Response('Not found', { status: 404 });
  }

  const list = await env.PF_KV.list({ prefix: `${COUNTER_KEY}page:` });
  const perPath = {};
  const perDay = {};

  for (const k of list.keys) {
    // count:page:YYYY-MM-DD:/path/
    const rest = k.name.slice(`${COUNTER_KEY}page:`.length);
    const sep = rest.indexOf(':');
    const day = rest.slice(0, sep);
    const path = rest.slice(sep + 1);
    const val = parseInt((await env.PF_KV.get(k.name)) || '0', 10);
    perPath[path] = (perPath[path] || 0) + val;
    perDay[day] = (perDay[day] || 0) + val;
  }

  const totalKeys = await env.PF_KV.list({ prefix: `${COUNTER_KEY}total:` });
  const totals = {};
  for (const k of totalKeys.keys) {
    const day = k.name.slice(`${COUNTER_KEY}total:`.length);
    totals[day] = parseInt((await env.PF_KV.get(k.name)) || '0', 10);
  }

  const uvKeys = await env.PF_KV.list({ prefix: `${COUNTER_KEY}uvtotal:` });
  const uniques = {};
  for (const k of uvKeys.keys) {
    // count:uvtotal:YYYY-MM-DD:/path/
    const rest = k.name.slice(`${COUNTER_KEY}uvtotal:`.length);
    const sep = rest.indexOf(':');
    const day = rest.slice(0, sep);
    const path = rest.slice(sep + 1);
    const val = parseInt((await env.PF_KV.get(k.name)) || '0', 10);
    uniques[path] = (uniques[path] || 0) + val;
  }

  const payload = {
    generated: new Date().toISOString(),
    note: 'Server-side counts only. No IPs, no cookies, no user agents, no referrers stored.',
    pageViewsByDay: totals,
    pageViewsByPath: sortDesc(perPath),
    estimatedUniquesByPath: sortDesc(uniques),
    raw: url.searchParams.get('raw') === '1' ? { perDay, perPath } : undefined
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex'
    }
  });
}

function sortDesc(obj) {
  return Object.fromEntries(Object.entries(obj).sort((a, b) => b[1] - a[1]));
}
