// Generate real JPG and WebP fixtures using the browser's own encoders,
// then test all 10 new tools end to end.
const { chromium } = require(process.env.PW || '/home/alaa0/.hermes/hermes-agent/node_modules/playwright');
const fs = require('fs');

const BASE = 'http://127.0.0.1:8899';
const results = [];

async function makeFixtures(page) {
  // Serve the PNG as bytes to the page, convert to JPG and WebP via canvas.
  const pngB64 = fs.readFileSync('/tmp/photo.png').toString('base64');
  const out = await page.evaluate(async (b64) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej;
      img.src = 'data:image/png;base64,' + b64; });

    const toDataUrl = (type, q) => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0);
      return c.toDataURL(type, q);
    };
    return {
      jpg: toDataUrl('image/jpeg', 0.92),
      webp: toDataUrl('image/webp', 0.85)
    };
  }, pngB64);

  for (const [k, dataUrl] of Object.entries(out)) {
    const b64 = dataUrl.split(',')[1];
    fs.writeFileSync(`/tmp/fixture.${k}`, Buffer.from(b64, 'base64'));
  }
  console.log('made fixture.jpg:', fs.statSync('/tmp/fixture.jpg').size, 'B');
  console.log('made fixture.webp:', fs.statSync('/tmp/fixture.webp').size, 'B');
}

async function test(page, { slug, files, setup, label, ext }) {
  const errors = [];
  const onErr = e => errors.push('PAGEERROR: ' + e.message);
  const onCon = m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text().slice(0, 130)); };
  page.on('pageerror', onErr); page.on('console', onCon);

  await page.goto(`${BASE}/${slug}/`, { waitUntil: 'networkidle' });
  await page.setInputFiles('#file', files);
  await page.waitForSelector('#list li', { timeout: 10000 });
  if (setup) { await setup(page); await page.waitForTimeout(500); }

  const dl = await Promise.race([
    page.waitForEvent('download', { timeout: 60000 }).catch(() => null),
    (async () => { await page.click('#controls button'); await page.waitForTimeout(60000); return null; })()
  ]).then(async r => {
    if (r) return r;
    const d = await page.waitForEvent('download', { timeout: 30000 }).catch(() => null);
    return d;
  });

  if (!dl) {
    await page.waitForTimeout(2000);
    const panel = (await page.textContent('#result, #status')).replace(/\s+/g, ' ').slice(0, 150);
    results.push({ label, ok: false, panel, errors });
    page.off('pageerror', onErr); page.off('console', onCon);
    return;
  }

  const outFile = `/tmp/new-${slug}.${ext}`;
  await dl.saveAs(outFile);
  await page.waitForSelector('.result.show', { timeout: 20000 }).catch(() => {});
  const panel = (await page.textContent('#result')).replace(/\s+/g, ' ').slice(0, 165);
  const proof = await page.evaluate(() => window.NetGuard.stats());

  results.push({ label, ok: proof.fileDataRequests === 0 && !errors.length,
                 file: dl.suggestedFilename(), bytes: fs.statSync(outFile).size,
                 out: outFile, panel, proof, errors });
  page.off('pageerror', onErr); page.off('console', onCon);
}

(async () => {
  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext({ acceptDownloads: true });
  const p = await ctx.newPage();

  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  await makeFixtures(p);

  await test(p, { slug: 'jpg-to-png', files: ['/tmp/fixture.jpg'], label: 'jpg → png', ext: 'png' });
  await test(p, { slug: 'webp-to-png', files: ['/tmp/fixture.webp'], label: 'webp → png', ext: 'png' });
  await test(p, { slug: 'webp-to-jpg', files: ['/tmp/fixture.webp'], label: 'webp → jpg', ext: 'jpg' });
  await test(p, { slug: 'rotate-image', files: ['/tmp/icon.png'], label: 'rotate image 90°',
                  ext: 'png', setup: async pg => pg.selectOption('#rot', '90') });
  await test(p, { slug: 'svg-to-png', files: ['/tmp/test.svg'], label: 'svg → png', ext: 'png' });
  await test(p, { slug: 'image-to-base64', files: ['/tmp/icon.png'], label: 'image → base64', ext: 'txt' });
  await test(p, { slug: 'compress-to-target-size', files: ['/tmp/photo.png'], label: 'compress to 200KB',
                  ext: 'jpg', setup: async pg => pg.fill('#target', '200') });
  await test(p, { slug: 'crop-image', files: ['/tmp/photo.png'], label: 'crop image',
                  ext: 'png', setup: async pg => { await pg.selectOption('#ratio', '1:1'); } });
  await test(p, { slug: 'favicon-generator', files: ['/tmp/logo.png'], label: 'favicon pack', ext: 'zip' });
  await test(p, { slug: 'png-to-ico', files: ['/tmp/icon.png'], label: 'png → ico', ext: 'ico' });

  console.log('\n=== NEW TOOL RESULTS ===');
  for (const r of results) {
    const mark = r.ok ? 'PASS' : 'FAIL';
    console.log(`${mark}  ${r.label.padEnd(22)} ${r.file || '(no download)'} ${r.bytes ? '(' + r.bytes + 'B)' : ''}`);
    if (r.panel) console.log(`      ${r.panel}`);
    if (r.errors && r.errors.length) r.errors.forEach(e => console.log('      ERR: ' + e));
  }
  const passed = results.filter(r => r.ok).length;
  console.log(`\n${passed}/${results.length} passed`);
  await b.close();
})().catch(e => { console.error('HARNESS ERROR:', e.message); process.exit(1); });
