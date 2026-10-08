import { canvasToBlob } from './lib.js';

let file = null, img = null;
const dz = document.getElementById('dz');
const input = document.getElementById('file');
const list = document.getElementById('list');
const controls = document.getElementById('controls');
const status = document.getElementById('status');
const result = document.getElementById('result');

initDropzone({ zone: dz, input, multiple: false, onFiles: async fs => {
  file = fs[0]; img = null;
  draw(); clearStatus(status); result.className = 'result';
  try { img = await PF.loadImage(await PF.readAsDataURL(file)); draw(); }
  catch { setStatus(status, 'err', 'Could not read that image.'); }
}});

const RATIOS = {
  free: null,
  '1:1': 1,
  '4:3': 4 / 3,
  '3:2': 3 / 2,
  '16:9': 16 / 9,
  '9:16': 9 / 16
};

function draw() {
  renderFileList(list, file ? [file] : [], () => { file = null; img = null; draw(); });
  controls.innerHTML = '';
  if (!file) return;

  if (!img) { setStatus(status, 'working', 'Reading image…'); return; }

  const w = img.naturalWidth, h = img.naturalHeight;

  const ratioField = document.createElement('div');
  ratioField.className = 'field';
  ratioField.innerHTML = `<label for="ratio">Aspect ratio</label>
    <select id="ratio">${Object.keys(RATIOS).map(k =>
      `<option value="${k}">${k === 'free' ? 'Free (set values yourself)' : k}</option>`).join('')}</select>`;
  controls.appendChild(ratioField);

  const row = document.createElement('div');
  row.style.display = 'flex'; row.style.gap = '12px'; row.style.flexWrap = 'wrap';
  row.innerHTML = `
    <div class="field"><label for="cx">Left (px)</label><input id="cx" type="number" min="0" max="${w}" value="0" style="width:110px"></div>
    <div class="field"><label for="cy">Top (px)</label><input id="cy" type="number" min="0" max="${h}" value="0" style="width:110px"></div>
    <div class="field"><label for="cw">Width (px)</label><input id="cw" type="number" min="1" max="${w}" value="${w}" style="width:110px"></div>
    <div class="field"><label for="ch">Height (px)</label><input id="ch" type="number" min="1" max="${h}" value="${h}" style="width:110px"></div>`;
  controls.appendChild(row);

  const preview = document.createElement('div');
  preview.style.marginTop = '14px';
  preview.innerHTML = `<p class="small muted" id="pin">Source: ${w} × ${h} px</p>
    <canvas id="pv" style="max-width:100%;border:1px solid var(--line);border-radius:8px"></canvas>`;
  controls.appendChild(preview);

  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.textContent = 'Crop and download';
  btn.onclick = run;
  controls.appendChild(btn);

  const g = id => document.getElementById(id);
  const clampAll = () => {
    const cw = Math.min(Math.max(1, +g('cw').value || 1), w);
    const ch = Math.min(Math.max(1, +g('ch').value || 1), h);
    g('cw').value = cw; g('ch').value = ch;
    g('cx').value = Math.min(Math.max(0, +g('cx').value || 0), w - cw);
    g('cy').value = Math.min(Math.max(0, +g('cy').value || 0), h - ch);
    updatePreview();
  };

  ratioField.querySelector('#ratio').addEventListener('change', e => {
    const r = RATIOS[e.target.value];
    if (!r) return;
    // Fit the largest region of this ratio, centred on the current selection.
    const cx = +g('cx').value, cy = +g('cy').value;
    let cw = w, ch = Math.round(w / r);
    if (ch > h) { ch = h; cw = Math.round(h * r); }
    g('cw').value = cw; g('ch').value = ch;
    g('cx').value = Math.min(Math.max(0, cx), w - cw);
    g('cy').value = Math.min(Math.max(0, cy), h - ch);
    updatePreview();
  });

  ['cx', 'cy', 'cw', 'ch'].forEach(id => g(id).addEventListener('input', clampAll));

  function updatePreview() {
    const cx = +g('cx').value, cy = +g('cy').value, cw = +g('cw').value, ch = +g('ch').value;
    const c = document.getElementById('pv');
    if (!c) return;
    // Draw the full image with the crop region highlighted, so the user sees context.
    const maxW = 520;
    const scale = Math.min(1, maxW / w);
    c.width = Math.round(w * scale);
    c.height = Math.round(h * scale);
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    // Dim everything outside the crop.
    ctx.fillStyle = 'rgba(15,26,20,.55)';
    const rx = cx * scale, ry = cy * scale, rw = cw * scale, rh = ch * scale;
    ctx.fillRect(0, 0, c.width, ry);
    ctx.fillRect(0, ry + rh, c.width, c.height - ry - rh);
    ctx.fillRect(0, ry, rx, rh);
    ctx.fillRect(rx + rw, ry, c.width - rx - rw, rh);
    ctx.strokeStyle = '#128a5b';
    ctx.lineWidth = 2;
    ctx.strokeRect(rx, ry, rw, rh);
    document.getElementById('pin').textContent =
      `Source: ${w} × ${h} px  →  crop: ${cw} × ${ch} px at (${cx}, ${cy})`;
  }

  clampAll();
}

async function run() {
  const g = id => document.getElementById(id);
  const cx = +g('cx').value, cy = +g('cy').value, cw = +g('cw').value, ch = +g('ch').value;

  try {
    const c = document.createElement('canvas');
    c.width = cw; c.height = ch;
    const ctx = c.getContext('2d');
    const isPng = /png$/i.test(file.type) || /\.png$/i.test(file.name);
    if (!isPng) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cw, ch); }
    ctx.drawImage(img, cx, cy, cw, ch, 0, 0, cw, ch);

    const ext = isPng ? 'png' : 'jpg';
    const blob = await canvasToBlob(c, isPng ? 'image/png' : 'image/jpeg', 0.92);
    PF.save(blob, `${PF.base(file.name)}-cropped-${cw}x${ch}.${ext}`);

    const s = NetGuard.stats();
    result.className = 'result show';
    result.innerHTML = `<h3>Cropped to ${cw} × ${ch}</h3>
      <p>From ${img.naturalWidth} × ${img.naturalHeight} px · ${PF.fmtBytes(blob.size)}</p>
      <p class="small">Your original file is unchanged.</p>
      <p class="small"><strong>Privacy check:</strong> files uploaded: <strong>${s.fileDataRequests}</strong>.</p>`;
  } catch (err) {
    setStatus(status, 'err', err.message || String(err));
  }
}

draw();
