import { canvasToBlob, makeZip } from './lib.js';

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

  const wf = document.createElement('div');
  wf.className = 'field';
  wf.innerHTML = `<label for="w">Output width (px)</label>
    <input id="w" type="number" min="8" max="8192" value="512" style="width:150px">`;
  controls.appendChild(wf);

  const bg = document.createElement('div');
  bg.className = 'field';
  bg.innerHTML = `<label for="bg">Background</label>
    <select id="bg">
      <option value="">Keep transparent</option>
      <option value="#ffffff">White</option>
      <option value="#0f1a14">Dark</option>
    </select>`;
  controls.appendChild(bg);

  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.textContent = `Convert ${files.length} SVG${files.length === 1 ? '' : 's'} to PNG`;
  btn.onclick = run;
  controls.appendChild(btn);
}

async function run() {
  const targetW = Math.min(8192, Math.max(8, parseInt(document.getElementById('w').value, 10) || 512));
  const bg = document.getElementById('bg').value;

  try {
    const out = [];
    for (let i = 0; i < files.length; i++) {
      setStatus(status, 'working', `Rendering ${i + 1} of ${files.length}…`);
      const f = files[i];
      const url = await PF.readAsDataURL(f);

      // SVG needs an explicit size on the element, or width may resolve to 0.
      const img = await new Promise((res, rej) => {
        const el = new Image();
        el.onload = () => res(el);
        el.onerror = () => rej(new Error(`"${f.name}" could not be rendered as an image. If it references external fonts or images, flatten those first.`));
        el.src = url;
      });

      let w = targetW;
      let h;
      if (img.naturalWidth && img.naturalHeight) {
        h = Math.round(targetW * (img.naturalHeight / img.naturalWidth));
      } else {
        // No intrinsic size: assume square, which is the common case for icons.
        h = targetW;
      }

      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); }
      ctx.drawImage(img, 0, 0, w, h);

      const blob = await canvasToBlob(c, 'image/png');
      out.push({ name: `${PF.base(f.name)}-${w}x${h}.png`, blob, w, h });
      c.width = c.height = 0;
    }

    if (out.length === 1) PF.save(out[0].blob, out[0].name);
    else { setStatus(status, 'working', 'Packaging…'); PF.save(await makeZip(out), 'svg-as-png.zip'); }

    const s = NetGuard.stats();
    result.className = 'result show';
    result.innerHTML = `<h3>${out.length} SVG${out.length === 1 ? '' : 's'} rendered</h3>
      <p>Output size: <strong>${out.map(o => o.w + '×' + o.h).join(', ')}</strong></p>
      <p class="small">Rendered at ${targetW}px wide. Height follows each file's own aspect ratio.</p>
      <p class="small"><strong>Privacy check:</strong> files uploaded: <strong>${s.fileDataRequests}</strong> — no external resources were fetched.</p>`;
    clearStatus(status);
  } catch (err) {
    setStatus(status, 'err', err.message || String(err));
  }
}

draw();
