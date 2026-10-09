#!/usr/bin/env node
/**
 * privafile.net static site builder.
 *
 * Zero dependencies. Reads tools.json (the registry), then emits:
 *   dist/index.html          homepage
 *   dist/<slug>/index.html   one page per tool
 *   dist/privacy/...         privacy proof page
 *   dist/how-it-works/...    explainer
 *   dist/src/*               assets
 *
 * Rule from the brief: no templated/duplicate pages. Every tool page has
 * genuinely distinct copy (intro, steps, FAQ) supplied in tools.json.
 */
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { guides } from './guides.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const SRC = join(root, 'src');
const OUT = join(root, 'dist');
const SITE = 'https://privafile.net';

const tools = JSON.parse(readFileSync(join(root, 'tools.json'), 'utf8'));
const site = JSON.parse(readFileSync(join(root, 'site.config.json'), 'utf8'));

/* ---------------- helpers ---------------- */
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const write = (p, content) => {
  const full = join(OUT, p);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
};
const jsonld = obj => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;

/* ---------------- layout ---------------- */
function layout({ title, description, canonical, content, jsonldBlocks = [], bodyClass = '' }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE}${canonical}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta property="og:type" content="website">
<meta property="og:site_name" content="privafile">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${SITE}${canonical}">
<meta name="twitter:card" content="summary">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<script src="/src/runtime.js"></script>
<link rel="stylesheet" href="/src/style.css">
${jsonldBlocks.join('\n')}
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
<a href="#main" class="hide">Skip to content</a>

<div class="privacy-strip"><span class="dot">●</span> Your files never leave your device. No upload. No signup. No watermark.</div>

<header class="site-header">
  <div class="wrap">
    <a class="brand" href="/"><span class="brand-mark" aria-hidden="true">🔒</span>privafile</a>
    <nav class="nav" aria-label="Main">
      <a href="/#tools">Tools</a>
      <a href="/guides/">Guides</a>
      <a href="/privacy/">Privacy proof</a>
      <a href="/how-it-works/">How it works</a>
    </nav>
  </div>
</header>

<main id="main">
${content}
</main>

<footer class="site-footer">
  <div class="wrap">
    <div class="cols">
      <div>
        <h4>Tools</h4>
        <ul>${tools.slice(0, 6).map(t => `<li><a href="/${t.slug}/">${esc(t.name)}</a></li>`).join('')}</ul>
      </div>
      <div>
        <h4>PDF</h4>
        <ul>${tools.filter(t => t.category === 'pdf').map(t => `<li><a href="/${t.slug}/">${esc(t.name)}</a></li>`).join('')}</ul>
      </div>
      <div>
        <h4>Images</h4>
        <ul>${tools.filter(t => t.category === 'image').map(t => `<li><a href="/${t.slug}/">${esc(t.name)}</a></li>`).join('')}</ul>
      </div>
      <div>
        <h4>About</h4>
        <ul>
          <li><a href="/guides/">All guides</a></li>
          <li><a href="/privacy/">Privacy proof</a></li>
          <li><a href="/how-it-works/">How it works</a></li>
          <li><a href="/privacy/#no-tracking">No tracking</a></li>
        </ul>
      </div>
    </div>
    <div class="bottom">
      <span>© <span id="yr">2026</span> privafile.net — files processed on your device.</span>
      <span>Built to be audited: <a href="/privacy/">check the network yourself</a>.</span>
    </div>
  </div>
</footer>
</body>
</html>`;
}

/* ---------------- tool page ---------------- */
function toolPage(t) {
  const breadcrumb = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Tools', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: t.name, item: `${SITE}/${t.slug}/` }
    ]
  };
  const app = {
    '@context': 'https://schema.org', '@type': 'WebApplication',
    name: t.name, url: `${SITE}/${t.slug}/`,
    applicationCategory: 'UtilitiesApplication', operatingSystem: 'Any (browser)',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    description: t.metaDescription
  };
  const faq = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: t.faq.map(f => ({
      '@type': 'Question', name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a }
    }))
  };

  const related = tools.filter(x => x.category === t.category && x.slug !== t.slug).slice(0, 4);

  const content = `
<div class="wrap">
  <nav class="crumbs" aria-label="Breadcrumb">
    <a href="/">Home</a><span>›</span><a href="/#tools">Tools</a><span>›</span>${esc(t.name)}
  </nav>

  <section class="hero" style="padding:34px 0 8px">
    <h1>${esc(t.h1)}</h1>
    <p class="lede">${esc(t.intro)}</p>
  </section>

  <div class="wrap narrow" style="padding:0">
    <div class="dropzone" id="dz" tabindex="0" role="button" aria-label="Choose files">
      <span class="dz-ico" aria-hidden="true">${t.icon}</span>
      <strong>${esc(t.dropText)}</strong>
      <span>${esc(t.acceptHint)}</span>
    </div>
    <input type="file" id="file" accept="${esc(t.accept)}" ${t.multiple ? 'multiple' : ''} hidden>

    <ul class="file-list" id="list"></ul>
    <div class="controls" id="controls"></div>
    <div class="status" id="status" role="status" aria-live="polite"></div>
    <div class="result" id="result"></div>
  </div>

  <div class="wrap narrow" style="padding:0">
    <div class="proof-panel">
      <h3>Live privacy check</h3>
      <div id="proof"></div>
    </div>
  </div>

  <section class="section narrow" style="margin:0 auto">
    <h2>How to ${esc(t.name.toLowerCase())}</h2>
    <ol class="steps">
      ${t.steps.map(s => `<li>${s}</li>`).join('')}
    </ol>
  </section>

  <section class="section narrow" style="margin:0 auto">
    <h2>Why this ${t.category === 'pdf' ? 'PDF' : 'image'} tool is private</h2>
    <p>${esc(t.privacyNote)}</p>
    <p class="small muted">Other tools in this category upload your file to a server, process it in the cloud, and return a download link. That means your document sits on someone else's disk — often with a retention window measured in hours. Here, the file is read by your browser, transformed in memory, and saved straight back to your disk. You can watch it happen in the live check above: the counter for files uploaded stays at zero.</p>
  </section>

  <section class="section narrow faq" style="margin:0 auto">
    <h2>Frequently asked</h2>
    ${t.faq.map(f => `<details><summary>${esc(f.q)}</summary><div class="faq-body">${esc(f.a)}</div></details>`).join('')}
  </section>

  <section class="section">
    <div class="wrap">
      <div class="section-head"><h2>Related tools</h2></div>
      <div class="grid cols-4">
        ${related.map(r => `
          <a class="tool-card" href="/${r.slug}/">
            <span class="ico" aria-hidden="true">${r.icon}</span>
            <h3>${esc(r.name)}</h3>
            <p>${esc(r.shortDescription)}</p>
          </a>`).join('')}
      </div>
    </div>
  </section>
</div>

<script type="module" src="/src/tools/${t.slug}.js"></script>`;

  return layout({
    title: t.title,
    description: t.metaDescription,
    canonical: `/${t.slug}/`,
    content,
    jsonldBlocks: [jsonld(app), jsonld(breadcrumb), jsonld(faq)]
  });
}

/* ---------------- homepage ---------------- */
function homePage() {
  const itemList = {
    '@context': 'https://schema.org', '@type': 'ItemList',
    itemListElement: tools.map((t, i) => ({
      '@type': 'ListItem', position: i + 1, name: t.name, url: `${SITE}/${t.slug}/`
    }))
  };
  const org = {
    '@context': 'https://schema.org', '@type': 'Organization',
    name: 'privafile', url: SITE + '/',
    description: 'Privacy-first in-browser file tools. Files are processed on your device and never uploaded.'
  };

  const byCat = cat => tools.filter(t => t.category === cat);

  const content = `
<div class="wrap">
  <section class="hero">
    <h1>File tools that <span class="accent">never upload</span> your files.</h1>
    <p class="lede">Merge, split, compress, convert and read files right in your browser. Your documents stay on your device — no upload, no signup, no watermark, no limits.</p>
    <a class="btn lg" href="#tools">Browse tools</a>
    <a class="btn secondary lg" href="/privacy/" style="margin-left:10px">Verify it yourself</a>
  </section>

  <section class="section" id="tools">
    <div class="section-head">
      <h2>PDF tools</h2>
      <p class="muted">Everything runs locally. Nothing is sent anywhere.</p>
    </div>
    <div class="grid cols-3">
      ${byCat('pdf').map(t => `
        <a class="tool-card" href="/${t.slug}/">
          <span class="chip">${esc(t.chip || 'PDF')}</span>
          <span class="ico" aria-hidden="true">${t.icon}</span>
          <h3>${esc(t.name)}</h3>
          <p>${esc(t.shortDescription)}</p>
        </a>`).join('')}
    </div>
  </section>

  <section class="section">
    <div class="section-head">
      <h2>Image tools</h2>
      <p class="muted">Compressed, resized and converted on your own machine.</p>
    </div>
    <div class="grid cols-3">
      ${byCat('image').map(t => `
        <a class="tool-card" href="/${t.slug}/">
          <span class="chip">${esc(t.chip || 'Image')}</span>
          <span class="ico" aria-hidden="true">${t.icon}</span>
          <h3>${esc(t.name)}</h3>
          <p>${esc(t.shortDescription)}</p>
        </a>`).join('')}
    </div>
  </section>

  <section class="section">
    <div class="card narrow" style="margin:0 auto">
      <h2 class="mt-0">How we can promise this</h2>
      <p>There is no server-side processing to disable, because there is no server. This site is a set of static files. When you pick a file, your browser reads it into memory, runs the same kind of code a desktop app would, and hands you back the result. Nothing is transmitted.</p>
      <p>Don't take our word for it — <a href="/privacy/">open the privacy proof page</a> and watch the live request counter while you use a tool. Or open your browser's developer tools, switch to the Network tab, and use any tool. You will see the file never leaves.</p>
      <p><a class="btn" href="/privacy/">See the live proof</a></p>
    </div>
  </section>
</div>`;

  return layout({
    title: site.defaultTitle,
    description: site.defaultDescription,
    canonical: '/',
    content,
    jsonldBlocks: [jsonld(itemList), jsonld(org)]
  });
}

/* ---------------- guide (how-to) page ---------------- */
function renderBlock(b) {
  if (b.h) return `<h2>${b.h}</h2>`;
  if (b.p) return `<p>${b.p}</p>`;
  if (b.ul) return `<ul>${b.ul.map(i => `<li>${i}</li>`).join('')}</ul>`;
  if (b.ol) return `<ol class="steps">${b.ol.map(i => `<li>${i}</li>`).join('')}</ol>`;
  if (b.note) return `<div class="guide-note"><strong>Worth knowing:</strong> ${b.note}</div>`;
  if (b.tool) {
    const t = tools.find(x => x.slug === b.tool);
    if (!t) return '';
    return `<a class="tool-card guide-tool" href="/${t.slug}/">
      <span class="ico" aria-hidden="true">${t.icon}</span>
      <span class="guide-tool-body">
        <strong>${esc(b.label || t.name)}</strong>
        <span>${esc(t.shortDescription)}</span>
      </span>
    </a>`;
  }
  return '';
}

function guidePage(g) {
  const breadcrumb = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Guides', item: SITE + '/guides/' },
      { '@type': 'ListItem', position: 2, name: g.h1, item: `${SITE}/guides/${g.slug}/` }
    ]
  };
  const article = {
    '@context': 'https://schema.org', '@type': 'Article',
    headline: g.h1,
    description: g.metaDescription,
    datePublished: g.published,
    dateModified: g.published,
    author: { '@type': 'Organization', name: 'privafile' },
    publisher: { '@type': 'Organization', name: 'privafile' },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE}/guides/${g.slug}/` }
  };

  const related = g.relatedTools
    .map(s => tools.find(t => t.slug === s))
    .filter(Boolean);
  const otherGuides = guides.filter(x => x.slug !== g.slug).slice(0, 4);

  const content = `
<div class="wrap narrow guide">
  <nav class="crumbs" aria-label="Breadcrumb">
    <a href="/">Home</a><span>›</span><a href="/guides/">Guides</a><span>›</span>${esc(g.h1)}
  </nav>

  <section class="hero" style="padding:30px 0 6px">
    <h1>${esc(g.h1)}</h1>
    <p class="lede" style="margin-left:0;text-align:left">${esc(g.lede)}</p>
    <p class="small muted" style="margin-top:14px">Updated ${esc(g.published)} · no upload, works offline once loaded</p>
  </section>

  <p class="guide-intro">${esc(g.intro)}</p>

  <div class="guide-body">
    ${g.body.map(renderBlock).join('\n    ')}
  </div>

  <section class="section" style="padding:34px 0 0">
    <h2>Tools used in this guide</h2>
    <div class="grid cols-2" style="margin-top:16px">
      ${related.map(t => `
      <a class="tool-card" href="/${t.slug}/">
        <span class="ico" aria-hidden="true">${t.icon}</span>
        <h3>${esc(t.name)}</h3>
        <p>${esc(t.shortDescription)}</p>
      </a>`).join('')}
    </div>
  </section>

  <section class="section" style="padding:34px 0 0">
    <h2>Other guides</h2>
    <ul class="guide-list">
      ${otherGuides.map(x => `<li><a href="/guides/${x.slug}/">${esc(x.h1)}</a></li>`).join('')}
    </ul>
    <p style="margin-top:18px"><a class="btn secondary" href="/guides/">All guides</a></p>
  </section>
</div>`;

  return layout({
    title: g.title,
    description: g.metaDescription,
    canonical: `/guides/${g.slug}/`,
    content,
    jsonldBlocks: [jsonld(article), jsonld(breadcrumb)]
  });
}

function guidesIndexPage() {
  const itemList = {
    '@context': 'https://schema.org', '@type': 'ItemList',
    itemListElement: guides.map((g, i) => ({
      '@type': 'ListItem', position: i + 1, name: g.h1, url: `${SITE}/guides/${g.slug}/`
    }))
  };

  const content = `
<div class="wrap">
  <section class="hero" style="padding:34px 0 10px">
    <h1>Guides</h1>
    <p class="lede">Straight answers to the questions that come up when you are actually trying to get something done — and honest about the parts that are not simple.</p>
  </section>

  <section class="section" style="padding-top:10px">
    <div class="grid cols-2">
      ${guides.map(g => `
      <a class="tool-card guide-card" href="/guides/${g.slug}/">
        <h3>${esc(g.h1)}</h3>
        <p>${esc(g.lede)}</p>
      </a>`).join('')}
    </div>
  </section>

  <section class="section">
    <div class="card narrow" style="margin:0 auto">
      <h2 class="mt-0">Why these exist</h2>
      <p>Most file-tool sites publish a page per keyword and call it content. These are written for the cases where the obvious answer is incomplete — the cover page that should not be numbered, the photo that carries your address, the upload limit that rejects a perfectly good document.</p>
      <p>Every guide states its caveats. If a technique has a downside, it is in the text rather than buried.</p>
    </div>
  </section>
</div>`;

  return layout({
    title: 'Guides — Practical, Honest How-Tos for PDFs and Images | privafile',
    description: 'Step-by-step guides for merging PDFs privately, removing photo location data, numbering pages, and the details that actually trip people up.',
    canonical: '/guides/',
    content,
    jsonldBlocks: [jsonld(itemList)]
  });
}

/* ---------------- static pages ---------------- */
function privacyPage() {
  const content = `
<div class="wrap narrow" style="padding-top:34px">
  <h1>Privacy proof</h1>
  <p class="lede" style="margin-left:0;text-align:left">This page is a live test, not a policy document. Run a tool, watch the counters, and check the claim yourself.</p>

  <div class="proof-panel">
    <h3>Live counters on this page</h3>
    <div id="proof"></div>
  </div>

  <h2>What the counters mean</h2>
  <ul>
    <li><strong>Files uploaded</strong> — how many outbound requests carried file content. This number is the whole ballgame. It must stay at zero, and if anything ever tried, our own guard would block it and flag it in red.</li>
    <li><strong>Outbound requests</strong> — any network activity the page initiated. Loading a stylesheet counts. Sending a file would count — which is why it must be zero.</li>
    <li><strong>External requests</strong> — requests leaving privafile.net. We intend this to be zero, so nothing about you reaches a third party.</li>
  </ul>

  <h2 id="no-tracking">No accounts, no cookies, no tracking scripts</h2>
  <p>There is no login, no cookie wall, and no upload storage — because there is nothing to store. We do not sell, share, or retain your files: we never receive them in the first place.</p>
  <p>Our intent is that tool pages make <strong>no third-party requests at all</strong>. The live counter above measures this on the page you are currently viewing, so you can check it rather than trust it. If that number is ever non-zero, something has been added to the site that we did not intend, and the counter is how you would catch it.</p>

  <h3>How we count visitors without tracking you</h3>
  <p>We do want to know roughly how many people use the site, so we count page views <strong>on the server</strong>, not in your browser. There is no analytics script on this page. The count is incremented when your browser asks for the page — a request it was making anyway — and your browser is told nothing extra.</p>
  <p>What we store is a number, per day, per page. That is the whole record. We do not keep IP addresses, cookies, user agents, referrers, or session identifiers. Because nothing identifying is retained, there is no way to reconstruct an individual visit from our data — which is deliberate. It also means we can tell you how many visits a page received, but not who visited it, and that suits us.</p>
  <p>We are hosted on a CDN and fronted by a server-side counter, so our infrastructure necessarily processes ordinary request metadata — your IP address and the page you asked for — in order to serve a response and increment a count. That is true of any website. What our host and counter never see, and cannot see, is the contents of your files.</p>

  <h2>Verify it independently — three ways</h2>
  <ol class="steps">
    <li><strong>Watch the counters above.</strong> Use any tool from this page. The uploaded-files counter stays at zero.</li>
    <li><strong>Open developer tools.</strong> Press F12, go to the Network tab, clear it, then run a tool. Filter for "Fetch/XHR" and "Doc". You will see no request carrying your file.</li>
    <li><strong>Go offline.</strong> Load a tool page, then disconnect your internet and use the tool. It still works — which is impossible if processing happened on a server.</li>
  </ol>

  <h2>What we would need for this to be false</h2>
  <p>It would require our own network guard to be bypassed. That guard wraps the browser's fetch API, XMLHttpRequest, and sendBeacon, inspects every outbound body, and rejects anything that looks like a file. Its source is <a href="/src/runtime.js">readable here</a> — you do not have to trust a summary of it.</p>

  <p><a class="btn" href="/#tools">Try a tool and watch</a></p>
</div>`;
  return layout({
    title: 'Privacy Proof — Verify That Files Never Leave Your Device | privafile',
    description: 'Run a live test that proves privafile processes your files on your device. Watch the counters, check the network tab, or go offline and keep working.',
    canonical: '/privacy/',
    content
  });
}

function howPage() {
  const content = `
<div class="wrap narrow" style="padding-top:34px">
  <h1>How it works</h1>
  <p class="lede" style="margin-left:0;text-align:left">Short version: your browser does the work, and the internet is not involved.</p>

  <h2>The long version</h2>
  <p>A normal online converter works like this: your file travels to a company's server, a program on that server changes it, and a link comes back. Somewhere in between, your document exists on hardware you do not control.</p>
  <p>privafile removes those steps. This site is a collection of static pages. When you choose a file, your browser reads it into memory and runs a processing library that was written to run in a browser. The result is written to a new file on your machine. The network is used once, to load the page, and never again.</p>

  <h3>What that changes</h3>
  <ul>
    <li><strong>Nothing to leak.</strong> No copy of your file is created anywhere else, so there is no copy to breach, sell, or hand over.</li>
    <li><strong>Nothing to wait for.</strong> No upload means no upload time. Large files are frequently faster here than on server-based tools.</li>
    <li><strong>Nothing to sign up for.</strong> No account, because there is no file store to attach an account to.</li>
    <li><strong>Works offline.</strong> Load the page, pull the plug, keep working. That is a good test of whether a tool is really local.</li>
  </ul>

  <h3>What browsers can and cannot do</h3>
  <p>This approach handles PDFs, images, and text comfortably. Heavy video transcoding and some audio formats are harder to do well in a browser, so we have kept those out rather than ship something slow or unreliable. Every tool listed on the site is one we believe runs well entirely on your device.</p>

  <h2>Common questions</h2>
  <div class="faq">
    <details><summary>Is there really no server?</summary><div class="faq-body">There is a static host that serves the page files, and nothing else. It has no processing code and never receives your documents.</div></details>
    <details><summary>Should I still be careful with sensitive files?</summary><div class="faq-body">Being careful is always sensible. The specific risk this design removes is the exposure created by uploading. Keep your own backups regardless — no file tool should be your only copy.</div></details>
    <details><summary>Are there file size limits?</summary><div class="faq-body">Any limit comes from your device's memory, not from us. Files of several hundred megabytes generally work on a modern machine; older phones handle less.</div></details>
  </div>

  <p><a class="btn" href="/#tools">Browse the tools</a></p>
</div>`;
  return layout({
    title: 'How privafile Works — Local, In-Browser File Processing | privafile',
    description: 'No server, no upload, no account. Learn how privafile processes PDFs, images and text entirely inside your browser, and how to test that yourself.',
    canonical: '/how-it-works/',
    content
  });
}

/* ---------------- robots / sitemap ---------------- */
function robots() {
  return `User-agent: *
Allow: /

Sitemap: ${SITE}/sitemap.xml
`;
}
function sitemap() {
  const urls = [
    '/', '/guides/', '/privacy/', '/how-it-works/',
    ...guides.map(g => `/guides/${g.slug}/`),
    ...tools.map(t => `/${t.slug}/`)
  ];
  const today = new Date().toISOString().slice(0, 10);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${SITE}${u}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>${u === '/' ? '1.0' : '0.8'}</priority></url>`).join('\n')}
</urlset>`;
}
function favicon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#128a5b"/><path d="M16 7a5 5 0 0 0-5 5v2h-1a1.5 1.5 0 0 0-1.5 1.5v7A1.5 1.5 0 0 0 10 24h12a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 22 14h-1v-2a5 5 0 0 0-5-5Zm-3 7v-2a3 3 0 1 1 6 0v2Z" fill="#fff"/></svg>`;
}

/* ---------------- build ---------------- */
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

write('index.html', homePage());
write('privacy/index.html', privacyPage());
write('how-it-works/index.html', howPage());
write('guides/index.html', guidesIndexPage());
guides.forEach(g => write(`guides/${g.slug}/index.html`, guidePage(g)));
tools.forEach(t => write(`${t.slug}/index.html`, toolPage(t)));
write('robots.txt', robots());
write('sitemap.xml', sitemap());
write('favicon.svg', favicon());

// assets
mkdirSync(join(OUT, 'src'), { recursive: true });
cpSync(join(SRC, 'style.css'), join(OUT, 'src/style.css'));
cpSync(join(SRC, 'runtime.js'), join(OUT, 'src/runtime.js'));
if (existsSync(join(SRC, 'tools'))) {
  mkdirSync(join(OUT, 'src/tools'), { recursive: true });
  for (const f of readdirSync(join(SRC, 'tools'))) {
    if (f === 'desktop.ini' || f.startsWith('.')) continue;
    cpSync(join(SRC, 'tools', f), join(OUT, 'src/tools', f));
  }
}
if (existsSync(join(SRC, 'vendor'))) cpSync(join(SRC, 'vendor'), join(OUT, 'src/vendor'), { recursive: true });

// Security headers, scoped rather than blanket.
//
// COEP/COOP are required for SharedArrayBuffer, which the WASM tools want.
// They serve no purpose on plain XML or text, and a sitemap carrying
// `Cross-Origin-Embedder-Policy: require-corp` is at best meaningless and at
// worst interferes with external fetchers. So: apply them to the app, leave
// the machine-readable files alone.
write('_headers', `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), camera=(), microphone=()

/sitemap.xml
  Content-Type: application/xml; charset=utf-8
  Cross-Origin-Resource-Policy: cross-origin

/robots.txt
  Content-Type: text/plain; charset=utf-8

/favicon.svg
  Cross-Origin-Resource-Policy: cross-origin

/src/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp

/*
  Cross-Origin-Opener-Policy: same-origin
`);

console.log(`✔ built ${tools.length} tools + ${guides.length} guides + 3 static pages → dist/`);
console.log(`  sitemap: ${1 + 1 + guides.length + 3 + tools.length} URLs`);
console.log(`  tools:  ${tools.map(t => t.slug).join(', ')}`);
console.log(`  guides: ${guides.map(g => g.slug).join(', ')}`);
