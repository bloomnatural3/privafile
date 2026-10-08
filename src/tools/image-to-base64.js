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
  btn.textContent = 'Encode to Base64';
  btn.onclick = run;
  controls.appendChild(btn);
}

async function run() {
  try {
    setStatus(status, 'working', 'Encoding…');
    const dataUrl = await PF.readAsDataURL(file);
    const m = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
    if (!m) throw new Error('That file could not be encoded.');

    const [, mime, b64] = m;
    const overhead = Math.round((b64.length / file.size - 1) * 100);

    PF.save(new Blob([dataUrl], { type: 'text/plain' }), `${PF.base(file.name)}-base64.txt`);

    const s = NetGuard.stats();
    const preview = (mime.startsWith('image/') && b64.length < 400000)
      ? `<img src="${dataUrl}" alt="preview" style="max-width:220px;border:1px solid var(--line);border-radius:8px;margin:12px 0">`
      : '';

    result.className = 'result show';
    result.innerHTML = `<h3>Encoded — ${b64.length.toLocaleString()} characters</h3>
      ${preview}
      <p class="small">Media type: <code>${mime}</code> · original ${PF.fmtBytes(file.size)} → ${PF.fmtBytes(b64.length)} encoded (+${overhead}%)</p>
      <p class="small">Saved as <code>${PF.base(file.name)}-base64.txt</code>. Copy the whole string for use in HTML or CSS.</p>
      <textarea readonly style="width:100%;min-height:150px;margin-top:10px;padding:12px;border:1px solid var(--line);border-radius:8px;font-family:var(--mono);font-size:.78rem">${dataUrl.slice(0, 20000)}${dataUrl.length > 20000 ? '\n… (truncated in this preview; the downloaded file is complete)' : ''}</textarea>
      <p class="small" style="margin-top:10px"><strong>Privacy check:</strong> files uploaded: <strong>${s.fileDataRequests}</strong>.</p>`;
    clearStatus(status);
  } catch (err) {
    setStatus(status, 'err', err.message || String(err));
  }
}

draw();
