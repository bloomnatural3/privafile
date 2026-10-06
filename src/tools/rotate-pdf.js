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

  const dir = document.createElement('div');
  dir.className = 'field';
  dir.innerHTML = `<label for="dir">Direction</label>
    <select id="dir">
      <option value="90">90° clockwise</option>
      <option value="180">180°</option>
      <option value="270">90° anticlockwise</option>
    </select>`;
  controls.appendChild(dir);

  const scope = document.createElement('div');
  scope.className = 'field';
  scope.innerHTML = `<label for="scope">Apply to</label>
    <select id="scope">
      <option value="all">All pages</option>
      <option value="some">Selected pages only</option>
    </select>`;
  controls.appendChild(scope);

  const pagesField = document.createElement('div');
  pagesField.className = 'field';
  pagesField.innerHTML = `<label for="pages">Pages</label>
    <input id="pages" type="text" placeholder="1,3,5-7" style="min-width:170px">`;

  scope.querySelector('#scope').addEventListener('change', e => {
    if (e.target.value === 'some') controls.insertBefore(pagesField, btn);
    else pagesField.remove();
  });

  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.textContent = 'Rotate and save';
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
    } else throw new Error(`"${part}" is not a page or range.`);
  }
  if (!set.size) throw new Error('Enter at least one page.');
  return set;
}

async function run() {
  const { degrees } = await getPdfLib();
  const { PDFDocument } = await getPdfLib();
  const deg = parseInt(document.getElementById('dir').value, 10);
  const scope = document.getElementById('scope').value;

  try {
    setStatus(status, 'working', 'Reading your PDF…');
    const bytes = await PF.readAsArrayBuffer(file);
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pages = doc.getPages();

    let targets;
    if (scope === 'all') {
      targets = pages.map((_, i) => i);
    } else {
      targets = [...parsePages(document.getElementById('pages').value, pages.length)];
    }

    targets.forEach(i => {
      const p = pages[i];
      const current = p.getRotation().angle || 0;
      p.setRotation(degrees((current + deg) % 360));
    });

    setStatus(status, 'working', 'Saving…');
    const saved = await doc.save();
    const blob = new Blob([saved], { type: 'application/pdf' });
    PF.save(blob, `${PF.base(file.name)}-rotated.pdf`);

    const s = NetGuard.stats();
    result.className = 'result show';
    result.innerHTML = `<h3>Rotated ${targets.length} page${targets.length === 1 ? '' : 's'} by ${deg}°</h3>
      <p>Saved as <code>${PF.base(file.name)}-rotated.pdf</code>.</p>
      <p class="small">If a page looks wrong in one reader but right in another, the reader may be ignoring the rotation value. Most respect it after this change.</p>
      <p class="small"><strong>Privacy check:</strong> files uploaded: <strong>${s.fileDataRequests}</strong>.</p>`;
    clearStatus(status);
  } catch (err) {
    setStatus(status, 'err', err.message || String(err));
  }
}

draw();
