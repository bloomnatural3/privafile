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

  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.textContent = 'Read metadata';
  btn.onclick = run;
  controls.appendChild(btn);
}

function fmtDate(d) {
  if (!d) return null;
  try {
    const dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    return dt.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
  } catch { return String(d); }
}

async function run() {
  const { PDFDocument } = await getPdfLib();
  try {
    setStatus(status, 'working', 'Reading your PDF…');
    const bytes = await PF.readAsArrayBuffer(file);
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });

    const rows = [
      ['Title', doc.getTitle()],
      ['Author', doc.getAuthor()],
      ['Subject', doc.getSubject()],
      ['Keywords', (doc.getKeywords() || '')],
      ['Creator', doc.getCreator()],
      ['Producer', doc.getProducer()],
      ['Created', fmtDate(doc.getCreationDate())],
      ['Modified', fmtDate(doc.getModificationDate())],
      ['Pages', String(doc.getPageCount())],
      ['PDF version', doc.getForm() ? 'with forms' : 'standard'],
    ].filter(([, v]) => v !== null && v !== undefined && v !== '');

    const size = file.size;
    const s = NetGuard.stats();

    result.className = 'result show';
    result.innerHTML = `<h3>Metadata found</h3>
      ${rows.length
        ? `<div style="margin:14px 0">${rows.map(([k, v]) =>
            `<div style="display:flex;gap:12px;padding:7px 0;border-bottom:1px solid var(--line)">
               <span style="min-width:120px;color:var(--muted)">${k}</span>
               <span style="word-break:break-word">${String(v).replace(/</g, '&lt;')}</span>
             </div>`).join('')}</div>`
        : `<p>This document carries no metadata fields at all — that is common for files produced by scanners.</p>`}
      <p class="small">File size: <strong>${PF.fmtBytes(size)}</strong> · ${doc.getPageCount()} page(s).</p>
      <p class="small muted">Metadata often contains the author's name, the software used, and the original creation date. That is why people strip it before sharing a file.</p>
      <p class="small"><strong>Privacy check:</strong> files uploaded: <strong>${s.fileDataRequests}</strong>.</p>`;
    clearStatus(status);
  } catch (err) {
    setStatus(status, 'err', err.message || String(err));
  }
}

draw();
