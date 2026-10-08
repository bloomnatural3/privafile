import { canvasToBlob, makeZip } from './lib.js';

let file = null;
const dz = document.getElementById('dz');
const input = document.getElementById('file');
const list = document.getElementById('list');
const controls = document.getElementById('controls');
const status = document.getElementById('status');
const result = document.getElementById('result');

initDropzone({ zone: dz, input, multiple: false, onFiles: fs => { file = fs[0]; draw(); clearStatus(status); result.className = 'result'; } });

const SIZES = [16, 32, 48, 64, 128, 180, 192, 256, 512];
const LABELS = {
  16: 'browser tab', 32: 'favicon standard', 48: 'Windows site icon',
  64: 'high-dpi tab', 128: 'Chrome Web Store', 180: 'Apple touch icon',
  192: 'Android home screen', 256: 'Windows app', 512: 'PWA splash'
};

function draw() {
  renderFileList(list, file ? [file] : [], () => { file = null; draw(); });
  controls.innerHTML = '';
  if (!file) return;

  const bg = document.createElement('div');
  bg.className = 'field';
  bg.innerHTML = `<label for="bg">Background (for transparent logos)</label>
    <select id="bg">
      <option value="">Keep transparent</option>
      <option value="#ffffff">White</option>
      <option value="#0f1a14">Dark</option>
    </select>`;
  controls.appendChild(bg);

  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.textContent = 'Generate favicons';
  btn.onclick = run;
  controls.appendChild(btn);

  const note = document.createElement('span');
  note.className = 'small muted';
  note.textContent = `Produces ${SIZES.length} PNG sizes.`;
  controls.appendChild(note);
}

async function run() {
  const bg = document.getElementById('bg').value;

  try {
    setStatus(status, 'working', 'Reading your image…');
    const img = await PF.loadImage(await PF.readAsDataURL(file));
    const w = img.naturalWidth, h = img.naturalHeight;
    const side = Math.min(w, h);

    const out = [];
    for (let i = 0; i < SIZES.length; i++) {
      const size = SIZES[i];
      setStatus(status, 'working', `Rendering ${size}×${size} (${i + 1} of ${SIZES.length})…`);

      const c = document.createElement('canvas');
      c.width = size; c.height = size;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, size, size); }

      // Centre-crop the source to a square, then scale to this size.
      const sx = (w - side) / 2, sy = (h - side) / 2;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);

      const blob = await canvasToBlob(c, 'image/png');
      out.push({ name: `favicon-${size}x${size}.png`, blob });
      c.width = c.height = 0;
    }

    setStatus(status, 'working', 'Packaging…');
    const zipBlob = await makeZip([
      ...out,
      {
        name: 'README.txt',
        blob: new Blob([`privafile.net favicon pack\n\nSizes included:\n` +
          SIZES.map(s => `  favicon-${s}x${s}.png  — ${LABELS[s]}`).join('\n') +
          `\n\nAdd to your <head>:\n` +
          `  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">\n` +
          `  <link rel="apple-touch-icon" sizes="180x180" href="/favicon-180x180.png">\n\n` +
          `Square cropped from: ${w}x${h} source (${side}px used).\n`], { type: 'text/plain' })
      }
    ], 'favicons.zip');

    PF.save(zipBlob, 'favicons.zip');

    const s = NetGuard.stats();
    result.className = 'result show';
    result.innerHTML = `<h3>${out.length} favicon sizes generated</h3>
      <p>Downloaded as <code>favicons.zip</code> (${PF.fmtBytes(zipBlob.size)}), with an HTML snippet in <code>README.txt</code>.</p>
      <p class="small">Source was ${w}×${h}; the centre ${side}×${side} square was used. ${w !== h ? '<strong>Your image was not square</strong>, so it was centre-cropped — check the 16×16 and 32×32 results look right.' : ''}</p>
      <p class="small"><strong>Privacy check:</strong> files uploaded: <strong>${s.fileDataRequests}</strong>.</p>`;
    clearStatus(status);
  } catch (err) {
    setStatus(status, 'err', err.message || String(err));
  }
}

draw();
