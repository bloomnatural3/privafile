import { canvasToBlob, makeZip } from './lib.js';
import { readExif } from './exif.js';

let files = [];
const dz = document.getElementById('dz');
const input = document.getElementById('file');
const list = document.getElementById('list');
const controls = document.getElementById('controls');
const status = document.getElementById('status');
const result = document.getElementById('result');

initDropzone({ zone: dz, input, multiple: true, onFiles: fs => { files = files.concat(fs); draw(); clearStatus(status); result.className = 'result'; } });

function draw() {
  renderFileList(list, files, i => { files.splice(i, 1); draw(); });
  controls.innerHTML = '';
  if (!files.length) return;

  const note = document.createElement('p');
  note.className = 'small muted';
  note.style.margin = '0 0 12px';
  note.textContent = 'The image is re-encoded rather than patched, so all metadata is dropped: camera, lens, date, software, GPS and thumbnails.';
  controls.appendChild(note);

  const q = document.createElement('div');
  q.className = 'field';
  q.innerHTML = `<label for="q">JPEG quality</label>
    <select id="q">
      <option value="0.95">95% — near-lossless</option>
      <option value="0.92" selected>92% — recommended</option>
      <option value="0.85">85% — smaller file</option>
      <option value="0.75">75% — smallest</option>
    </select>`;
  controls.appendChild(q);

  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.textContent = `Strip metadata from ${files.length} image${files.length === 1 ? '' : 's'}`;
  btn.onclick = run;
  controls.appendChild(btn);
}

async function run() {
  const q = parseFloat(document.getElementById('q').value);
  const out = [];
  let totalRemoved = 0;
  let withGps = 0;

  try {
    for (let i = 0; i < files.length; i++) {
      setStatus(status, 'working', `Processing ${i + 1} of ${files.length}…`);
      const f = files[i];
      const buf = await PF.readAsArrayBuffer(f);
      const before = readExif(buf);
      if (before.gps) withGps++;
      totalRemoved += before.fields.length;

      const img = await PF.loadImage(await PF.readAsDataURL(f));
      const isPng = /png$/i.test(f.type) || /\.png$/i.test(f.name);
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d');
      if (!isPng) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
      ctx.drawImage(img, 0, 0);

      const blob = await canvasToBlob(c, isPng ? 'image/png' : 'image/jpeg', isPng ? undefined : q);
      out.push({ name: `${PF.base(f.name)}-clean.${isPng ? 'png' : 'jpg'}`, blob });
      c.width = c.height = 0;
    }

    if (out.length === 1) PF.save(out[0].blob, out[0].name);
    else { setStatus(status, 'working', 'Packaging…'); PF.save(await makeZip(out), 'metadata-stripped.zip'); }

    const s = NetGuard.stats();
    result.className = 'result show';
    result.innerHTML = `<h3>${out.length} image${out.length === 1 ? '' : 's'} cleaned</h3>
      <p>Removed <strong>${totalRemoved}</strong> metadata field${totalRemoved === 1 ? '' : 's'} in total.</p>
      ${withGps ? `<p><strong>${withGps}</strong> of these image${withGps === 1 ? '' : 's'} carried GPS coordinates — those are now gone.</p>` : ''}
      <p class="small">Pixel data is preserved at full resolution; only the metadata and the original encoding are replaced.</p>
      <p class="small muted">Note: re-encoding always changes the compressed bytes slightly, so file size may differ either way. Use PNG output to keep it lossless.</p>
      <p class="small"><strong>Privacy check:</strong> files uploaded: <strong>${s.fileDataRequests}</strong>.</p>`;
    clearStatus(status);
  } catch (err) {
    setStatus(status, 'err', err.message || String(err));
  }
}

draw();
