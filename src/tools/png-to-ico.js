import { canvasToBlob } from './lib.js';

let file = null;
const dz = document.getElementById('dz');
const input = document.getElementById('file');
const list = document.getElementById('list');
const controls = document.getElementById('controls');
const status = document.getElementById('status');
const result = document.getElementById('result');

initDropzone({ zone: dz, input, multiple: false, onFiles: fs => { file = fs[0]; draw(); clearStatus(status); result.className = 'result'; } });

const SIZES = [16, 32, 48, 64, 128, 256];

function draw() {
  renderFileList(list, file ? [file] : [], () => { file = null; draw(); });
  controls.innerHTML = '';
  if (!file) return;

  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.textContent = 'Create ICO';
  btn.onclick = run;
  controls.appendChild(btn);

  const note = document.createElement('span');
  note.className = 'small muted';
  note.textContent = `Bundles ${SIZES.join(', ')} px into one .ico.`;
  controls.appendChild(note);
}

/**
 * Build a Windows ICO containing several PNG-encoded images.
 *
 * Layout: ICONDIR (6 bytes) | ICONDIRENTRY per image (16 bytes each) | image data.
 * We store each frame as PNG, which Vista and later support for every size here.
 */
function buildIco(frames) {
  const ICONDIR = 6;
  const ENTRY = 16;
  const header = new ArrayBuffer(ICONDIR + ENTRY * frames.length);
  const dv = new DataView(header);

  // ICONDIR
  dv.setUint16(0, 0, true);              // reserved, must be 0
  dv.setUint16(2, 1, true);              // type: 1 = icon
  dv.setUint16(4, frames.length, true);  // number of images

  let offset = ICONDIR + ENTRY * frames.length;
  frames.forEach((f, i) => {
    const p = ICONDIR + ENTRY * i;
    // 0 means 256 in the ICO format.
    dv.setUint8(p + 0, f.size >= 256 ? 0 : f.size);  // width
    dv.setUint8(p + 1, f.size >= 256 ? 0 : f.size);  // height
    dv.setUint8(p + 2, 0);       // palette colours
    dv.setUint8(p + 3, 0);       // reserved
    dv.setUint16(p + 4, 1, true);  // colour planes
    dv.setUint16(p + 6, 32, true); // bits per pixel (RGBA)
    dv.setUint32(p + 8, f.bytes.length, true);
    dv.setUint32(p + 12, offset, true);
    offset += f.bytes.length;
  });

  return new Blob([header, ...frames.map(f => f.bytes)], { type: 'image/x-icon' });
}

async function run() {
  const btn = controls.querySelector('button');

  try {
    btn.disabled = true;
    setStatus(status, 'working', 'Reading your PNG…');
    const img = await PF.loadImage(await PF.readAsDataURL(file));
    const w = img.naturalWidth, h = img.naturalHeight;
    const side = Math.min(w, h);

    if (side < 256) {
      setStatus(status, 'err', `That image is ${w}×${h}. For a crisp 256px icon, start from an image at least 256×256 — larger is better, since we scale down rather than up.`);
      btn.disabled = false;
      return;
    }

    const frames = [];
    for (let i = 0; i < SIZES.length; i++) {
      const size = SIZES[i];
      setStatus(status, 'working', `Rendering ${size}×${size} (${i + 1} of ${SIZES.length})…`);

      const c = document.createElement('canvas');
      c.width = size; c.height = size;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      // No background fill — keep the alpha so the icon has no white box.
      const sx = (w - side) / 2, sy = (h - side) / 2;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);

      const blob = await canvasToBlob(c, 'image/png');
      frames.push({ size, blob, bytes: new Uint8Array(await blob.arrayBuffer()) });
      c.width = c.height = 0;
    }

    setStatus(status, 'working', 'Assembling the ICO…');
    const ico = buildIco(frames);
    PF.save(ico, `${PF.base(file.name)}.ico`);

    const s = NetGuard.stats();
    result.className = 'result show';
    result.innerHTML = `<h3>ICO created — ${frames.length} sizes in one file</h3>
      <p>${PF.fmtBytes(ico.size)} · saved as <code>${PF.base(file.name)}.ico</code></p>
      <p class="small">Contains: ${SIZES.map(x => x + '×' + x).join(', ')}. Transparency preserved.</p>
      ${w !== h ? '<p class="small">Your source was not square, so the centre square was used.</p>' : ''}
      <p class="small"><strong>Privacy check:</strong> files uploaded: <strong>${s.fileDataRequests}</strong>.</p>`;
    clearStatus(status);
    btn.disabled = false;
  } catch (err) {
    setStatus(status, 'err', err.message || String(err));
    btn.disabled = false;
  }
}

draw();
