import { getPdfLib, makeZip } from './lib.js';

let file = null;
let mode = 'each';
const dz = document.getElementById('dz');
const input = document.getElementById('file');
const list = document.getElementById('list');
const controls = document.getElementById('controls');
const status = document.getElementById('status');
const result = document.getElementById('result');

initDropzone({ zone: dz, input, multiple: false, onFiles: fs => { file = fs[0]; draw(); clearStatus(status); result.className = 'result'; } });

function rangeField() {
  const wrap = document.createElement('div');
  wrap.className = 'field';
  wrap.innerHTML = `<label for="ranges">Ranges</label>
    <input id="ranges" type="text" placeholder="1-3, 7, 10-12" style="min-width:220px">`;
  return wrap;
}

function draw() {
  renderFileList(list, file ? [file] : [], () => { file = null; draw(); });
  controls.innerHTML = '';
  if (!file) return;

  const modeField = document.createElement('div');
  modeField.className = 'field';
  modeField.innerHTML = `<label for="mode">Split mode</label>
    <select id="mode">
      <option value="each">One file per page</option>
      <option value="ranges">Custom ranges</option>
    </select>`;
  controls.appendChild(modeField);

  let rf = null;
  const update = () => {
    if (rf) { rf.remove(); rf = null; }
    if (modeField.querySelector('#mode').value === 'ranges' && !rf) {
      rf = rangeField();
      controls.insertBefore(rf, btn);
    }
  };

  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.textContent = 'Split PDF';
  btn.onclick = run;

  controls.appendChild(btn);
  modeField.querySelector('#mode').addEventListener('change', update);
}

function parseRanges(str, max) {
  const groups = [];
  for (const part of str.split(',').map(s => s.trim()).filter(Boolean)) {
    const m = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      let [, a, b] = m; a = +a; b = +b;
      if (a > b) [a, b] = [b, a];
      if (a < 1 || b > max) throw new Error(`Range ${part} is outside 1–${max}.`);
      const arr = []; for (let i = a; i <= b; i++) arr.push(i - 1);
      groups.push({ label: `${a}-${b}`, indices: arr });
    } else if (/^\d+$/.test(part)) {
      const n = +part;
      if (n < 1 || n > max) throw new Error(`Page ${n} is outside 1–${max}.`);
      groups.push({ label: `${n}`, indices: [n - 1] });
    } else {
      throw new Error(`"${part}" is not a page or range. Try 1-3, 7, 10-12.`);
    }
  }
  if (!groups.length) throw new Error('Enter at least one page or range.');
  return groups;
}

async function run() {
  const { PDFDocument } = await getPdfLib();
  const modeVal = document.getElementById('mode').value;
  try {
    setStatus(status, 'working', 'Reading your PDF…');
    const bytes = await PF.readAsArrayBuffer(file);
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const total = src.getPageCount();

    let groups;
    if (modeVal === 'each') {
      groups = Array.from({ length: total }, (_, i) => ({ label: String(i + 1), indices: [i] }));
    } else {
      groups = parseRanges(document.getElementById('ranges').value, total);
    }

    const base = PF.base(file.name);
    const out = [];
    for (let i = 0; i < groups.length; i++) {
      setStatus(status, 'working', `Building file ${i + 1} of ${groups.length}…`);
      const doc = await PDFDocument.create();
      const pages = await doc.copyPages(src, groups[i].indices);
      pages.forEach(p => doc.addPage(p));
      const b = await doc.save();
      out.push({ name: `${base}-${groups[i].label}.pdf`, blob: new Blob([b], { type: 'application/pdf' }) });
    }

    if (out.length === 1) {
      PF.save(out[0].blob, out[0].name);
    } else {
      setStatus(status, 'working', 'Packaging files…');
      PF.save(await makeZip(out), `${base}-split.zip`);
    }

    const s = NetGuard.stats();
    result.className = 'result show';
    result.innerHTML = `<h3>Done — ${out.length} file${out.length > 1 ? 's' : ''} created</h3>
      <p>${out.length === 1 ? 'Your split file has been downloaded.' : 'Your files were packaged into a ZIP and downloaded.'}</p>
      <p class="small">Source document had ${total} page${total === 1 ? '' : 's'}.</p>
      <p class="small"><strong>Privacy check:</strong> files uploaded: <strong>${s.fileDataRequests}</strong>.</p>`;
    clearStatus(status);
  } catch (err) {
    setStatus(status, 'err', err.message || String(err));
  }
}

draw();
