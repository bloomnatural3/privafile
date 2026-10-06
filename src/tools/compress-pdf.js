import { getPdfLib, getPdfJs, canvasToBlob } from './lib.js';

let file = null;
const dz = document.getElementById('dz');
const input = document.getElementById('file');
const list = document.getElementById('list');
const controls = document.getElementById('controls');
const status = document.getElementById('status');
const result = document.getElementById('result');

initDropzone({ zone: dz, input, multiple: false, onFiles: fs => { file = fs[0]; draw(); clearStatus(status); result.className = 'result'; } });

/* Render-then-rebuild compression.
 *
 * pdf-lib cannot rasterise, so we cannot recompress embedded images in place.
 * The reliable browser technique: render each page with pdf.js to a canvas,
 * downscale it, encode it as JPEG at the chosen quality, and build a new PDF
 * from those images. Real, verifiable size reduction on image-heavy files.
 *
 * Trade-off, stated plainly in the UI: text becomes non-selectable, because
 * the output pages are pictures. We only claim savings we actually measured.
 */
const LEVELS = {
  light:    { dpi: 150, quality: 0.80, label: 'Light — 150 dpi, keeps detail' },
  balanced: { dpi: 110, quality: 0.65, label: 'Balanced — 110 dpi, good all-round' },
  strong:   { dpi: 75,  quality: 0.45, label: 'Strong — 75 dpi, smallest file' }
};

function draw() {
  renderFileList(list, file ? [file] : [], () => { file = null; draw(); });
  controls.innerHTML = '';
  if (!file) return;

  const f = document.createElement('div');
  f.className = 'field';
  f.innerHTML = `<label for="level">Compression level</label>
    <select id="level">
      ${Object.entries(LEVELS).map(([k, v]) => `<option value="${k}"${k === 'balanced' ? ' selected' : ''}>${v.label}</option>`).join('')}
    </select>`;
  controls.appendChild(f);

  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.textContent = 'Compress PDF';
  btn.onclick = run;
  controls.appendChild(btn);
}

async function run() {
  const { PDFDocument } = await getPdfLib();
  const pdfjs = await getPdfJs();
  const level = LEVELS[document.getElementById('level').value];
  const btn = controls.querySelector('button');

  try {
    btn.disabled = true;
    setStatus(status, 'working', 'Opening your PDF…');
    const bytes = await PF.readAsArrayBuffer(file);
    const src = await pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise;

    // pdf.js viewport scale: 72 pt per inch is the PDF base unit.
    const scale = level.dpi / 72;

    const out = await PDFDocument.create();
    let imgBytesTotal = 0;

    for (let i = 1; i <= src.numPages; i++) {
      setStatus(status, 'working', `Rendering page ${i} of ${src.numPages}…`);
      const page = await src.getPage(i);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;

      const jpg = await canvasToBlob(canvas, 'image/jpeg', level.quality);
      imgBytesTotal += jpg.size;

      const embedded = await out.embedJpg(await jpg.arrayBuffer());
      const { width, height } = page.getViewport({ scale: 1 });
      const p = out.addPage([width, height]);
      p.drawImage(embedded, { x: 0, y: 0, width, height });

      canvas.width = canvas.height = 0;
    }

    setStatus(status, 'working', 'Finishing the file…');
    const saved = await out.save({ useObjectStreams: true });
    const blob = new Blob([saved], { type: 'application/pdf' });

    const before = file.size;
    const after = blob.size;
    const pct = before ? Math.round((1 - after / before) * 100) : 0;

    if (after >= before) {
      btn.disabled = false;
      setStatus(status, 'err',
        `No saving achieved: the rebuilt file would be ${PF.fmtBytes(after)} against your original ${PF.fmtBytes(before)}. ` +
        `This usually means the PDF is already optimised, or is mostly text rather than images. Your original is the better file.`);
      return;
    }

    PF.save(blob, `${PF.base(file.name)}-compressed.pdf`);

    const s = NetGuard.stats();
    result.className = 'result show';
    result.innerHTML = `<h3>Compressed by ${pct}%</h3>
      <p>${PF.fmtBytes(before)} → <strong>${PF.fmtBytes(after)}</strong> · ${src.numPages} page${src.numPages === 1 ? '' : 's'} at ${level.dpi} dpi</p>
      <p class="small">Saved as <code>${PF.base(file.name)}-compressed.pdf</code>. Your original is untouched.</p>
      <p class="small"><strong>Trade-off:</strong> pages in the output are images, so text is no longer selectable or searchable. Keep the original if you need a text layer — or use this when you mainly need a smaller file to send.</p>
      <p class="small"><strong>Privacy check:</strong> files uploaded: <strong>${s.fileDataRequests}</strong>.</p>`;
    clearStatus(status);
    btn.disabled = false;
  } catch (err) {
    setStatus(status, 'err', err.message || 'Could not read that PDF. It may be password-protected.');
    btn.disabled = false;
  }
}

draw();
