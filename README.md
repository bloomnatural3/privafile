# privafile.net

Privacy-first, in-browser file tools. **Files are processed on the user's device and never uploaded.**

No backend. No database. No file storage. The entire site is static files plus client-side
JavaScript and WASM.

## Why this can make the claim it makes

There is no server-side processing to disable, because there is no server. `src/runtime.js`
installs a **network guard** that wraps `fetch`, `XMLHttpRequest` and `sendBeacon`, inspects
every outbound body, and rejects anything carrying file data. Every tool page shows a live
counter of files uploaded — it stays at zero, and would flag red if anything ever tried.

## Build

```bash
node build.mjs          # writes dist/
```

No dependencies. The build reads `tools.json` (the tool registry) and emits:

- `dist/index.html` — homepage
- `dist/<slug>/index.html` — one page per tool
- `dist/privacy/` — the live proof page
- `dist/how-it-works/` — explainer
- `dist/robots.txt`, `dist/sitemap.xml`, `dist/favicon.svg`, `dist/_headers`

## Adding a tool

1. Add an entry to `tools.json` with **unique** copy — the brief forbids templated or
   duplicate pages, so `intro`, `steps`, `privacyNote` and `faq` must be genuinely
   specific to the tool.
2. Add the implementation at `src/tools/<slug>.js`. It should:
   - use `initDropzone()` from the runtime
   - do all work locally with `File`/`Blob`/`ArrayBuffer`
   - call `PF.save(blob, filename)` to deliver the result
   - report `NetGuard.stats().fileDataRequests` in its result panel
3. Run `node build.mjs`. That's it — nav, footer, sitemap and JSON-LD all update.

## Dependencies (all loaded from CDN at runtime, licence-audited)

| Library | Licence | Used for |
|---|---|---|
| pdf-lib | MIT | PDF create/modify (merge, split, rotate, remove, image→PDF) |
| pdfjs-dist | Apache-2.0 | PDF render/parse (PDF→JPG, compress) |
| tesseract.js | Apache-2.0 | OCR |
| browser-image-compression | MIT | (available; image tools currently use canvas directly) |

**Not used, and why:**
- `libheif-js` — LGPL-3.0. HEIC tools are held pending approval (see `../ESCALATIONS.md`, ESC-003).
- `ffmpeg.wasm` — build licence unresolved (ffmpegwasm/ffmpeg.wasm#902). Audio/video deferred (ESC-004).
- `jszip` — dual MIT/GPL; we ship a small **self-written** ZIP writer instead (`src/tools/lib.js`),
  so no copyleft dependency enters the bundle at all.

## Testing

`tests/e2e.cjs` drives every tool in a real headless Chromium, feeds it a fixture, captures the
download, and asserts three things: the output file is produced, no JavaScript error occurred,
and `NetGuard` recorded **zero** file-bearing requests.

```bash
cd dist && python3 -m http.server 8899 &
node tests/e2e.cjs
```

See `../LOG.md` for verified results.
