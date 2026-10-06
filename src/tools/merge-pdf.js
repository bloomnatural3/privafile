import { getPdfLib } from './lib.js';

let files = [];
const dz = document.getElementById('dz');
const input = document.getElementById('file');
const list = document.getElementById('list');
const controls = document.getElementById('controls');
const status = document.getElementById('status');
const result = document.getElementById('result');

initDropzone({
  zone: dz, input, multiple: true,
  onFiles: fs => { files = files.concat(fs); draw(); clearStatus(status); result.className = 'result'; }
});

function draw() {
  renderFileList(list, files, i => { files.splice(i, 1); draw(); });
  controls.innerHTML = '';
  if (!files.length) return;
  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.textContent = `Merge ${files.length} PDFs`;
  btn.disabled = files.length < 2;
  btn.onclick = run;
  controls.appendChild(btn);
  if (files.length < 2) {
    const hint = document.createElement('span');
    hint.className = 'small muted';
    hint.textContent = 'Add at least two files.';
    controls.appendChild(hint);
  }
}

async function run() {
  const { PDFDocument } = await getPdfLib();
  setStatus(status, 'working', `Reading ${files.length} files…`);
  try {
    const out = await PDFDocument.create();
    for (let i = 0; i < files.length; i++) {
      setStatus(status, 'working', `Merging file ${i + 1} of ${files.length}…`);
      const bytes = await PF.readAsArrayBuffer(files[i]);
      let src;
      try {
        src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      } catch (e) {
        throw new Error(`"${files[i].name}" could not be read. It may be password-protected or corrupt.`);
      }
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach(p => out.addPage(p));
    }
    setStatus(status, 'working', 'Writing the merged document…');
    const merged = await out.save();
    const blob = new Blob([merged], { type: 'application/pdf' });
    PF.save(blob, 'merged.pdf');

    const s = NetGuard.stats();
    result.className = 'result show';
    result.innerHTML = `<h3>Done — ${out.getPageCount()} pages combined</h3>
      <p>Your merged file has been saved to your downloads as <code>merged.pdf</code> (${PF.fmtBytes(blob.size)}).</p>
      <p class="small"><strong>Privacy check:</strong> files uploaded during this operation: <strong>${s.fileDataRequests}</strong>.</p>`;
    clearStatus(status);
  } catch (err) {
    setStatus(status, 'err', err.message || String(err));
  }
}

draw();
