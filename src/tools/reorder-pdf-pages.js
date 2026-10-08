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
  f.innerHTML = `<label for="order">New page order</label>
    <input id="order" type="text" placeholder="3,1,2,4-6" style="min-width:220px">
    <p class="small muted" style="margin-top:6px">Use page numbers from the original file, in the order you want them. Ranges like <code>4-6</code> are allowed. Repeat a number to duplicate a page.</p>`;
  controls.appendChild(f);

  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.textContent = 'Reorder pages';
  btn.onclick = run;
  controls.appendChild(btn);
}

function parseOrder(str, max) {
  const out = [];
  const parts = str.split(',').map(s => s.trim()).filter(Boolean);
  if (!parts.length) throw new Error('Enter at least one page number.');
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
    } else {
      throw new Error(`"${part}" is not a page or range. Try 3,1,2,4-6.`);
    }
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
    const order = parseOrder(document.getElementById('order').value, total);

    if (order.length > 3000) {
      setStatus(status, 'err', `That would produce ${order.length} pages, which is too many to build in a browser.`);
      return;
    }

    setStatus(status, 'working', `Building a ${order.length}-page document…`);
    const out = await PDFDocument.create();
    const copied = await out.copyPages(src, order);
    copied.forEach(p => out.addPage(p));

    const saved = await out.save({ useObjectStreams: true });
    PF.save(new Blob([saved], { type: 'application/pdf' }), `${PF.base(file.name)}-reordered.pdf`);

    const dupes = order.length - new Set(order).size;
    const omitted = total - new Set(order).size;
    const s = NetGuard.stats();
    result.className = 'result show';
    result.innerHTML = `<h3>Reordered — ${order.length} page${order.length === 1 ? '' : 's'}</h3>
      <p>Original had <strong>${total}</strong> page${total === 1 ? '' : 's'}; the result has <strong>${order.length}</strong>.</p>
      ${dupes ? `<p class="small">${dupes} page${dupes === 1 ? '' : 's'} duplicated.</p>` : ''}
      ${omitted ? `<p class="small">${omitted} page${omitted === 1 ? '' : 's'} left out.</p>` : ''}
      <p class="small"><strong>Privacy check:</strong> files uploaded: <strong>${s.fileDataRequests}</strong>.</p>`;
    clearStatus(status);
  } catch (err) {
    setStatus(status, 'err', err.message || String(err));
  }
}

draw();
