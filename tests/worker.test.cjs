// Local test of the worker. Fakes the KV namespace and the ASSETS binding,
// then asserts the counting behaviour and the storage discipline.
const worker = require('../worker/index.test-bridge.cjs');

function makeKV() {
  const store = new Map();
  const puts = [];
  return {
    store, puts,
    async get(k) { return store.has(k) ? store.get(k) : null; },
    async put(k, v, opts) { store.set(k, v); puts.push({ k, v, opts }); },
    async list({ prefix = '' } = {}) {
      return { keys: [...store.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })) };
    }
  };
}

function makeAssets(html = '<!doctype html><title>privafile</title>') {
  return {
    async fetch(req) {
      const url = new URL(req.url);
      const isPage = !/\.\w+$/.test(url.pathname);
      return new Response(isPage ? html : 'asset', {
        status: 200,
        headers: { 'content-type': isPage ? 'text/html;charset=utf-8' : 'text/css' }
      });
    }
  };
}

(async () => {
  const env = { PF_KV: makeKV(), ASSETS: makeAssets(), STATS_KEY: 'test-key-123' };
  const ctx = { waitUntil: p => p };
  const call = (path, extra = {}) => worker.default.fetch(
    new Request('https://privafile.net' + path, { headers: { 'CF-Connecting-IP': '203.0.113.9', 'User-Agent': 'TestAgent/1.0' }, ...extra }),
    env, ctx
  );

  let pass = 0, fail = 0;
  const check = (name, cond) => { if (cond) { pass++; console.log('  PASS', name); } else { fail++; console.log('  FAIL', name); } };

  console.log('=== counting behaviour ===');
  await call('/');
  await call('/');
  await call('/merge-pdf/');
  await call('/merge-pdf');       // no trailing slash — should fold into the same page
  await call('/src/style.css');   // asset — must not count
  await call('/robots.txt');      // must not count
  await call('/_stats?key=test-key-123'); // must not count itself

  const kv = env.PF_KV;
  const homeCount = parseInt(await kv.get('count:page:' + new Date().toISOString().slice(0,10) + ':/') || '0');
  const mergeCount = parseInt(await kv.get('count:page:' + new Date().toISOString().slice(0,10) + ':/merge-pdf/') || '0');

  check('homepage counted twice', homeCount === 2);
  check('/merge-pdf/ and /merge-pdf fold together', mergeCount === 2);
  check('no key for style.css', ![...kv.store.keys()].some(k => k.includes('style.css')));
  check('no key for robots.txt', ![...kv.store.keys()].some(k => k.includes('robots.txt')));
  check('_stats not counted', ![...kv.store.keys()].some(k => k.includes('_stats')));

  console.log('\n=== storage discipline (nothing identifying) ===');
  const allKeys = [...kv.store.keys()];
  const allVals = [...kv.store.values()];
  check('no IP stored anywhere', !allKeys.concat(allVals).some(s => String(s).includes('203.0.113.9')));
  check('no user agent stored anywhere', !allKeys.concat(allVals).some(s => String(s).includes('TestAgent')));
  check('every value is a plain number', allVals.every(v => /^\d+$/.test(String(v))));
  check('keys hold no identifier', allKeys.every(k => /^count:[a-z]+:\d{4}-\d{2}-\d{2}/.test(k) || /^count:uv:/.test(k)));

  console.log('\n=== stats endpoint security ===');
  const bad = await call('/_stats?key=wrong');
  check('wrong key → 404', bad.status === 404);
  const none = await call('/_stats');
  check('no key → 404', none.status === 404);

  const good = await call('/_stats?key=test-key-123');
  check('correct key → 200', good.status === 200);
  const body = await good.json();
  check('reports pageViewsByPath', !!body.pageViewsByPath);
  check('homepage shows 2 views', body.pageViewsByPath['/'] === 2);
  check('carries the privacy note', /No IPs, no cookies/.test(body.note));
  check('is marked noindex', good.headers.get('x-robots-tag') === 'noindex');

  console.log('\n=== non-HTML requests are not counted ===');
  const before = [...kv.store.keys()].length;
  await call('/sitemap.xml');
  await call('/favicon.svg');
  const after = [...kv.store.keys()].length;
  check('xml/svg did not add counters', after === before);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
