/* Shared browser-side libraries, loaded from a CDN only when a tool needs them.
 * We load them as ES modules from unpkg/jsdelivr; core libraries are MIT / Apache-2.0.
 * Vendor copies can be added under src/vendor/ for fully self-hosted builds. */

const CDN = {
  pdfLib: 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm',
  pdfJs: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.min.mjs',
  pdfJsWorker: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs',
  tesseract: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.0/dist/tesseract.esm.min.js'
};

const _cache = new Map();

/* Some CDN ESM builds expose their API on the module namespace, others only on
 * `default`. Normalise: if `default` looks like the real API object, use it. */
function unwrap(mod, requiredFn) {
  if (mod && typeof mod[requiredFn] === 'function') return mod;
  if (mod && mod.default && typeof mod.default[requiredFn] === 'function') return mod.default;
  return mod;
}

/** Load an ES module once, cached. */
export async function load(name) {
  if (_cache.has(name)) return _cache.get(name);
  const p = import(CDN[name]);
  _cache.set(name, p);
  return p;
}

export async function getPdfLib() {
  return unwrap(await load('pdfLib'), 'PDFDocument');
}

let _pdfjs = null;
export async function getPdfJs() {
  if (_pdfjs) return _pdfjs;
  const pdfjs = await import(CDN.pdfJs);
  pdfjs.GlobalWorkerOptions.workerSrc = CDN.pdfJsWorker;
  _pdfjs = pdfjs;
  return _pdfjs;
}

export async function getTesseract() {
  return unwrap(await load('tesseract'), 'createWorker');
}

/** Canvas to Blob helper. */
export function canvasToBlob(canvas, type = 'image/png', quality = 0.92) {
  return new Promise((res, rej) => {
    canvas.toBlob(b => (b ? res(b) : rej(new Error('Canvas encoding failed'))), type, quality);
  });
}

/** Make a ZIP from [{name, blob}] using a tiny stored-mode writer (no deps). */
export async function makeZip(entries) {
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;

  const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  const crc32 = buf => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };

  for (const { name, blob } of entries) {
    const nameBytes = enc.encode(name);
    const data = new Uint8Array(await blob.arrayBuffer());
    const crc = crc32(data);

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    chunks.push(local, data);

    const cen = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    cen.set(nameBytes, 46);
    central.push(cen);

    offset += local.length + data.length;
  }

  const centralSize = central.reduce((a, c) => a + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  return new Blob([...chunks, ...central, end], { type: 'application/zip' });
}
