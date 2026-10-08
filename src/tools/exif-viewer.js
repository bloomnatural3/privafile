import { readExif } from './exif.js';

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
  btn.textContent = 'Read EXIF data';
  btn.onclick = run;
  controls.appendChild(btn);
}

async function run() {
  try {
    setStatus(status, 'working', 'Reading image…');
    const buf = await PF.readAsArrayBuffer(file);
    const { found, fields, gps } = readExif(buf);

    if (!found && !gps) {
      result.className = 'result show';
      result.innerHTML = `<h3>No EXIF data found</h3>
        <p>This image carries no readable EXIF metadata. That is normal for PNG files, most screenshots, and images that have already been stripped or re-saved by a social platform.</p>
        <p class="small">File type: <code>${file.type || PF.ext(file.name)}</code> · size: ${PF.fmtBytes(file.size)}</p>`;
      clearStatus(status);
      return;
    }

    const s = NetGuard.stats();
    const group = (name) => fields.filter(f => name(f));
    const camera = group(f => /Camera|Lens|Software|Artist|Copyright/.test(f.name));
    const exposure = group(f => /Exposure|F-number|ISO|Shutter|Aperture|Focal|Flash|Metering/.test(f.name));
    const when = group(f => /Date|Time/.test(f.name));
    const image = group(f => /Width|Height|Orientation|Resolution|Colour|Image description/.test(f.name));
    const shown = new Set([...camera, ...exposure, ...when, ...image]);
    const other = fields.filter(f => !shown.has(f));

    const table = (rows) => `<div style="margin:12px 0">${rows.map(f =>
      `<div style="display:flex;gap:12px;padding:7px 0;border-bottom:1px solid var(--line)">
         <span style="min-width:150px;color:var(--muted)">${f.name}</span>
         <span style="word-break:break-word">${String(f.value).replace(/</g, '&lt;')}</span>
       </div>`).join('')}</div>`;

    result.className = 'result show';
    result.innerHTML = `<h3>EXIF data found — ${fields.length} field${fields.length === 1 ? '' : 's'}</h3>
      ${camera.length ? `<h4 style="margin:16px 0 0;font-size:.95rem">Camera and software</h4>${table(camera)}` : ''}
      ${exposure.length ? `<h4 style="margin:16px 0 0;font-size:.95rem">Exposure settings</h4>${table(exposure)}` : ''}
      ${when.length ? `<h4 style="margin:16px 0 0;font-size:.95rem">Dates</h4>${table(when)}` : ''}
      ${image.length ? `<h4 style="margin:16px 0 0;font-size:.95rem">Image</h4>${table(image)}` : ''}
      ${gps ? `<h4 style="margin:16px 0 0;font-size:.95rem">Location</h4>
        <p>GPS coordinates: <strong>${gps.lat}, ${gps.lon}</strong>
        — <a href="https://www.openstreetmap.org/?mlat=${gps.lat}&mlon=${gps.lon}#map=15/${gps.lat}/${gps.lon}" target="_blank" rel="noopener noreferrer">view on OpenStreetMap</a></p>
        <p class="small muted">That link opens a different website, which will see your visit. We do not send anything to it.</p>` : ''}
      ${other.length ? `<h4 style="margin:16px 0 0;font-size:.95rem">Other</h4>${table(other)}` : ''}
      <p class="small" style="margin-top:14px"><strong>Privacy check:</strong> files uploaded: <strong>${s.fileDataRequests}</strong>.</p>`;
    clearStatus(status);
  } catch (err) {
    setStatus(status, 'err', err.message || String(err));
  }
}

draw();
