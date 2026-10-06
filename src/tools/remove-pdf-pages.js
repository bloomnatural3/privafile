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
  f.innerHTML = `<label for="pages">Pages to remove</label>
    <input id="pages" type="text" placeholder="2,5,9-11" style="min-width:200px">`;
  controls.appendChild(f);

  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.textContent = 'Remove pages';
  btn.onclick = run;
  controls.appendChild(btn);
}

function parsePages(str, max) {
  const set = new Set();
  for (const part of str.split(',').map(s => s.trim()).filter(Boolean)) {
    const m = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      let [, a, b] = m; a = +a; b = +b;
      if (a > b) [a, b] = [b, a];
      if (a < 1 || b > max) throw new Error(`Range ${part} is outside 1–${max}.`);
      for (let i = a; i <= b; i++) set.add(i - 1);
    } else if (/^\d+$/.test(part)) {
      const n = +part;
      if (n < 1 || n > max) throw new Error(`Page ${n} is outside 1–${max}.`);
      set.add(n - 1);
    } else throw new Error(`"${part}" is not a page or range. Try 2,5,9-11.`);
  }
  if (!set.size) throw new Error('Enter at least one page to remove.');
  return set;
}

async function run() {
  const { PDFDocument } = await getPdfLib();
  try {
    setStatus(status, 'working', 'Reading your PDF…');
    const bytes = await PF.readAsArrayBuffer(file);
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const total = src.getPageCount();
    const drop = parsePages(document.getElementById('pages').value, total);

    if (drop.size >= total) {
      setStatus(status, 'err', `You selected all ${total} pages. Removing every page would leave an empty document.`);
      return;
    }

    const keep = [];
    for (let i = 0; i < total; i++) if (!drop.has(i)) keep.push(i);

    setStatus(status, 'working', 'Building the trimmed document…');
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, keep);
    pages.forEach(p => out.addPage(p));
    const saved = await out.save();
    const blob = new Blob([saved], { type: 'application/pdf' });
    PF.save(blob, `${PF.base(file.name)}-trimmed.pdf`);

    const s = NetGuard.stats();
    result.className = 'result show';
    result.innerHTML = `<h3>Removed ${total - keep.length} page${total - keep.length === 1 ? '' : 's'}</h3>
      <p>${total} pages → <strong>${keep.length} pages</strong> (${PF.fmtBytes(blob.size)})</p>
      <p class="small">Saved as <code>${PF.base(file.name)}-trimmed.pdf</code>. Your original file is untouched.</p>
      <p class="small"><strong>Privacy check:</strong> files uploaded: <strong>${s.fileDataRequests}</strong>.</p>`;
    clearStatus(status);
  } catch (err) {
    setStatus(status, 'err', err.message || String(err));
  }
}

draw();
