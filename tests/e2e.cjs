const { chromium } = require(process.env.PW || '/home/alaa0/.hermes/hermes-agent/node_modules/playwright');
const fs = require('fs');

const BASE = 'http://127.0.0.1:8899';
const results = [];

async function runTool(page, { slug, files, setup, label }) {
  const errors = [];
  const onErr = e => errors.push('PAGEERROR: ' + e.message);
  const onCon = m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); };
  page.on('pageerror', onErr);
  page.on('console', onCon);

  await page.goto(`${BASE}/${slug}/`, { waitUntil: 'networkidle' });
  await page.setInputFiles('#file', files);
  await page.waitForSelector('#list li', { timeout: 8000 });

  if (setup) await setup(page);

  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }),
    page.click('#controls button')
  ]);
  const out = `/tmp/out-${slug}${dl.suggestedFilename().endsWith('.zip') ? '.zip' : '.' + dl.suggestedFilename().split('.').pop()}`;
  await dl.saveAs(out);

  await page.waitForSelector('.result.show', { timeout: 15000 });
  const panel = (await page.textContent('#result')).replace(/\s+/g, ' ').slice(0, 180);
  const proof = await page.evaluate(() => {
    const s = window.NetGuard.stats();
    return { uploaded: s.fileDataRequests, total: s.total, external: s.externalRequests };
  });

  results.push({ label, file: dl.suggestedFilename(), bytes: fs.statSync(out).size, out,
                 panel, proof, errors: [...errors] });

  page.off('pageerror', onErr);
  page.off('console', onCon);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();

  await runTool(page, {
    slug: 'resize-image', files: ['/tmp/test-image.png'], label: 'resize to 200px wide',
    setup: async p => { await p.fill('#w', '200'); await p.waitForTimeout(400); }
  });

  await runTool(page, {
    slug: 'png-to-jpg', files: ['/tmp/test-image.png'], label: 'png → jpg'
  });

  await runTool(page, {
    slug: 'jpg-to-pdf', files: ['/tmp/test-image.png'], label: 'png → pdf'
  });

  await runTool(page, {
    slug: 'rotate-pdf', files: ['/tmp/test-a.pdf'], label: 'rotate 90°',
    setup: async p => { await p.selectOption('#dir', '90'); }
  });

  await runTool(page, {
    slug: 'split-pdf', files: ['/tmp/test-a.pdf'], label: 'split each page'
  });

  await runTool(page, {
    slug: 'remove-pdf-pages', files: ['/tmp/test-a.pdf'], label: 'remove page 1',
    setup: async p => { await p.fill('#pages', '1'); }
  });

  await runTool(page, {
    slug: 'pdf-to-jpg', files: ['/tmp/test-a.pdf'], label: 'pdf → jpg'
  });

  await runTool(page, {
    slug: 'compress-image', files: ['/tmp/test-image.png'], label: 'compress image'
  });

  console.log('=== E2E RESULTS ===');
  for (const r of results) {
    const ok = r.proof.uploaded === 0 && r.errors.length === 0 && r.bytes > 0;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${r.label.padEnd(22)} → ${r.file} (${r.bytes}B) | uploaded=${r.proof.uploaded} reqs=${r.proof.total} ext=${r.proof.external}`);
    console.log(`      panel: ${r.panel}`);
    if (r.errors.length) r.errors.forEach(e => console.log('      ERR: ' + e));
  }
  const passed = results.filter(r => r.proof.uploaded === 0 && !r.errors.length && r.bytes > 0).length;
  console.log(`\n${passed}/${results.length} passed`);

  await browser.close();
})().catch(e => { console.error('HARNESS ERROR:', e.message); process.exit(1); });
