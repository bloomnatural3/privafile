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

  const pos = document.createElement('div');
  pos.className = 'field';
  pos.innerHTML = `<label for="pos">Position</label>
    <select id="pos">
      <option value="bottom-center">Bottom centre</option>
      <option value="bottom-right">Bottom right</option>
      <option value="bottom-left">Bottom left</option>
      <option value="top-center">Top centre</option>
      <option value="top-right">Top right</option>
      <option value="top-left">Top left</option>
    </select>`;
  controls.appendChild(pos);

  const fmt = document.createElement('div');
  fmt.className = 'field';
  fmt.innerHTML = `<label for="fmt">Format</label>
    <select id="fmt">
      <option value="n">1, 2, 3</option>
      <option value="n-of-t">1 of 24</option>
      <option value="page-n">Page 1</option>
      <option value="page-n-of-t">Page 1 of 24</option>
      <option value="-n-">- 1 -</option>
    </select>`;
  controls.appendChild(fmt);

  const start = document.createElement('div');
  start.className = 'field';
  start.innerHTML = `<label for="start">Start numbering at</label>
    <input id="start" type="number" value="1" min="1" max="9999" style="width:90px">`;
  controls.appendChild(start);

  const skip = document.createElement('div');
  skip.className = 'field';
  skip.innerHTML = `<label for="skip">Skip first N pages</label>
    <input id="skip" type="number" value="0" min="0" max="9999" style="width:90px">
    <p class="small muted" style="margin-top:6px">Useful when page one is a cover you do not want numbered.</p>`;
  controls.appendChild(skip);

  const size = document.createElement('div');
  size.className = 'field';
  size.innerHTML = `<label for="size">Font size</label>
    <input id="size" type="number" value="10" min="6" max="28" style="width:90px">`;
  controls.appendChild(size);

  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.textContent = 'Add page numbers';
  btn.onclick = run;
  controls.appendChild(btn);
}

function label(fmt, n, total) {
  switch (fmt) {
    case 'n-of-t': return `${n} of ${total}`;
    case 'page-n': return `Page ${n}`;
    case 'page-n-of-t': return `Page ${n} of ${total}`;
    case '-n-': return `- ${n} -`;
    default: return String(n);
  }
}

async function run() {
  const { PDFDocument, StandardFonts, rgb } = await getPdfLib();
  try {
    setStatus(status, 'working', 'Reading your PDF…');
    const bytes = await PF.readAsArrayBuffer(file);
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const font = await doc.embedFont(StandardFonts.Helvetica);

    const pos = document.getElementById('pos').value;
    const fmt = document.getElementById('fmt').value;
    const startAt = Math.max(1, parseInt(document.getElementById('start').value, 10) || 1);
    const skip = Math.max(0, parseInt(document.getElementById('skip').value, 10) || 0);
    const size = Math.min(28, Math.max(6, parseInt(document.getElementById('size').value, 10) || 10));

    const pages = doc.getPages();
    const numbered = pages.length - skip;
    if (numbered <= 0) {
      setStatus(status, 'err', `You asked to skip ${skip} pages, but the document only has ${pages.length}.`);
      return;
    }

    const margin = 28;
    for (let i = skip; i < pages.length; i++) {
      const page = pages[i];
      const n = startAt + (i - skip);
      const text = label(fmt, n, numbered);
      const { width, height } = page.getSize();
      const w = font.widthOfTextAtSize(text, size);

      let x, y;
      const top = pos.startsWith('top');
      const [side] = pos.split('-').slice(1);
      if (side === 'left') x = margin;
      else if (side === 'right') x = width - margin - w;
      else x = (width - w) / 2;
      y = top ? height - margin - size : margin;

      page.drawText(text, { x, y, size, font, color: rgb(0.25, 0.25, 0.28) });
    }

    setStatus(status, 'working', 'Writing the file…');
    const saved = await doc.save({ useObjectStreams: true });
    PF.save(new Blob([saved], { type: 'application/pdf' }), `${PF.base(file.name)}-numbered.pdf`);

    const s = NetGuard.stats();
    result.className = 'result show';
    result.innerHTML = `<h3>Numbers added to ${numbered} page${numbered === 1 ? '' : 's'}</h3>
      <p>Style: <strong>${label(fmt, startAt, numbered)}</strong> · position: <strong>${pos.replace('-', ' ')}</strong> · starting at <strong>${startAt}</strong>${skip ? ` · first <strong>${skip}</strong> page(s) skipped` : ''}.</p>
      <p class="small">The text is real, selectable, searchable text — not an image overlay.</p>
      <p class="small"><strong>Privacy check:</strong> files uploaded: <strong>${s.fileDataRequests}</strong>.</p>`;
    clearStatus(status);
  } catch (err) {
    setStatus(status, 'err', err.message || String(err));
  }
}

draw();
