import { getPdfLib } from './lib.js';

let file = null;
const dz = document.getElementById('dz');
const input = document.getElementById('file');
const list = document.getElementById('list');
const controls = document.getElementById('controls');
const status = document.getElementById('status');
const result = document.getElementById('result');

initDropzone({ zone: dz, input, multiple: false, onFiles: fs => { file = fs[0]; draw(); clearStatus(status); result.className = 'result'; } });

function draw() {
  renderFileList(list, file ? [file] : [], () => { file = null; draw(); });
  controls.innerHTML = '';
  if (!file) return;

  const f = document.createElement('div');
  f.className = 'field';
  f.innerHTML = `<label for="pages">Pages to extract</label>
    <input id="pages" type="text" placeholder="1-3,7,12" style="min-width:200px">
    <p class="small muted" style="margin-top:6px">These pages become a new document. Everything else is left behind.</p>`;
  controls.appendChild(f);

  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.textContent = 'Extract pages';
  btn.onclick = run;
  controls.appendChild(btn);
}

function parsePages(str, max) {
  const out = [];
  const parts = str.split(',').map(s => s.trim()).filter(Boolean);
  if (!parts.length) throw new Error('Enter at least one page or range.');
  for (const part of parts) {
    const m = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      let [, a, b] = m; a = +a; b = +b;
      if (a > b) [a, b] = [b, a];
      if (a < 1 || b > max) throw new Error(`Range ${part} is outside 1–${max}.`);
      for (let i = a; i <= b; i++) out.push(i - 1);
    } else if (/^\d+$/.test(part)) {
      const n = +part;
      if (n < 1 || n > max) throw new Error(`Page ${n} is outside 1–${max}.`);
      out.push(n - 1);
    } else throw new Error(`"${part}" is not a page or range. Try 1-3,7,12.`);
  }
  return out;
}

async function run() {
  const { PDFDocument } = await getPdfLib();
  try {
    setStatus(status, 'working', 'Reading your PDF…');
    const bytes = await PF.readAsArrayBuffer(file);
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const total = src.getPageCount();
    const wanted = parsePages(document.getElementById('pages').value, total);

    setStatus(status, 'working', `Extracting ${wanted.length} page${wanted.length === 1 ? '' : 's'}…`);
    const out = await PDFDocument.create();
    const copied = await out.copyPages(src, wanted);
    copied.forEach(p => out.addPage(p));

    const saved = await out.save({ useObjectStreams: true });
    PF.save(new Blob([saved], { type: 'application/pdf' }), `${PF.base(file.name)}-extracted.pdf`);

    const s = NetGuard.stats();
    result.className = 'result show';
    result.innerHTML = `<h3>Extracted ${wanted.length} page${wanted.length === 1 ? '' : 's'}</h3>
      <p>From a ${total}-page document. The new file contains only the pages you asked for, in the original order.</p>
      <p class="small">Saved as <code>${PF.base(file.name)}-extracted.pdf</code>.</p>
      <p class="small"><strong>Privacy check:</strong> files uploaded: <strong>${s.fileDataRequests}</strong>.</p>`;
    clearStatus(status);
  } catch (err) {
    setStatus(status, 'err', err.message || String(err));
  }
}

draw();
