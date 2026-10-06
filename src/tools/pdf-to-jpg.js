import { getPdfJs, makeZip, canvasToBlob } from './lib.js';

let file = null;
const dz = document.getElementById('dz');
const input = document.getElementById('file');
const list = document.getElementById('list');
const controls = document.getElementById('controls');
const status = document.getElementById('status');
const result = document.getElementById('result');

initDropzone({ zone: dz, input, multiple: false, onFiles: fs => { file = fs[0]; draw(); clearStatus(status); result.className = 'result'; } });

const DPI = { 96: 1, 150: 1.5625, 300: 3.125 };

function draw() {
  renderFileList(list, file ? [file] : [], () => { file = null; draw(); });
  controls.innerHTML = '';
  if (!file) return;

  const fmt = document.createElement('div');
  fmt.className = 'field';
  fmt.innerHTML = `<label for="fmt">Format</label>
    <select id="fmt"><option value="image/jpeg">JPG</option><option value="image/png">PNG</option></select>`;
  controls.appendChild(fmt);

  const dpi = document.createElement('div');
  dpi.className = 'field';
  dpi.innerHTML = `<label for="dpi">Resolution</label>
    <select id="dpi">
      <option value="96">96 dpi — screen</option>
      <option value="150" selected>150 dpi — good balance</option>
      <option value="300">300 dpi — print</option>
    </select>`;
  controls.appendChild(dpi);

  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.textContent = 'Convert to images';
  btn.onclick = run;
  controls.appendChild(btn);
}

async function run() {
  const pdfjs = await getPdfJs();
  const fmt = document.getElementById('fmt').value;
  const scale = DPI[document.getElementById('dpi').value];
  const ext = fmt === 'image/png' ? 'png' : 'jpg';

  try {
    setStatus(status, 'working', 'Opening your PDF…');
    const bytes = await PF.readAsArrayBuffer(file);
    const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
    const base = PF.base(file.name);
    const out = [];
    let total = 0;

    for (let i = 1; i <= doc.numPages; i++) {
      setStatus(status, 'working', `Rendering page ${i} of ${doc.numPages}…`);
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      const blob = await canvasToBlob(canvas, fmt, 0.92);
      total += blob.size;
      out.push({ name: `${base}-page-${String(i).padStart(2, '0')}.${ext}`, blob });
      canvas.width = canvas.height = 0;
    }

    if (out.length === 1) PF.save(out[0].blob, out[0].name);
    else {
      setStatus(status, 'working', 'Packaging images into a ZIP…');
      PF.save(await makeZip(out), `${base}-images.zip`);
    }

    const s = NetGuard.stats();
    result.className = 'result show';
    result.innerHTML = `<h3>${out.length} image${out.length === 1 ? '' : 's'} created</h3>
      <p>Total output size: <strong>${PF.fmtBytes(total)}</strong>${out.length > 1 ? ', delivered as one ZIP.' : '.'}</p>
      <p class="small">Each page was rendered at ${document.getElementById('dpi').value} dpi.</p>
      <p class="small"><strong>Privacy check:</strong> files uploaded: <strong>${s.fileDataRequests}</strong>.</p>`;
    clearStatus(status);
  } catch (err) {
    setStatus(status, 'err', err.message || 'Could not read that PDF. It may be password-protected.');
  }
}

draw();
