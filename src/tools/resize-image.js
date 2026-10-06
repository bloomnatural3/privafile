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

  const w = document.createElement('div');
  w.className = 'field';
  w.innerHTML = `<label for="w">Width (px)</label><input id="w" type="number" min="1" placeholder="e.g. 1200" style="width:130px">`;
  controls.appendChild(w);

  const h = document.createElement('div');
  h.className = 'field';
  h.innerHTML = `<label for="h">Height (px)</label><input id="h" type="number" min="1" placeholder="auto" style="width:130px">`;
  controls.appendChild(h);

  const lock = document.createElement('div');
  lock.className = 'field';
  lock.innerHTML = `<label for="lock">Aspect ratio</label>
    <select id="lock"><option value="1">Locked (recommended)</option><option value="0">Unlocked</option></select>`;
  controls.appendChild(lock);

  const up = document.createElement('div');
  up.className = 'field';
  up.innerHTML = `<label for="up">Enlarging</label>
    <select id="up"><option value="0">Don't enlarge</option><option value="1">Allow enlarge</option></select>`;
  controls.appendChild(up);

  // Live auto-fill of the counterpart dimension when locked.
  const wi = w.querySelector('#w'), hi = h.querySelector('#h');
  const sync = e => {
    if (lock.querySelector('#lock').value !== '1') return;
    const src = files[0];
    if (!src) return;
    PF.loadImage(URL.createObjectURL(src)).then(img => {
      const r = img.naturalWidth / img.naturalHeight;
      if (e.target === wi && wi.value) hi.value = Math.round(wi.value / r);
      else if (e.target === hi && hi.value) wi.value = Math.round(hi.value * r);
    });
  };
  wi.addEventListener('input', sync);
  hi.addEventListener('input', sync);

  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.textContent = `Resize ${files.length} image${files.length === 1 ? '' : 's'}`;
  btn.onclick = run;
  controls.appendChild(btn);
}

async function run() {
  const tw = parseInt(document.getElementById('w').value, 10) || 0;
  const th = parseInt(document.getElementById('h').value, 10) || 0;
  const locked = document.getElementById('lock').value === '1';
  const allowUp = document.getElementById('up').value === '1';

  if (!tw && !th) {
    setStatus(status, 'err', 'Enter a width, a height, or both.');
    return;
  }

  try {
    const out = [];
    for (let i = 0; i < files.length; i++) {
      setStatus(status, 'working', `Resizing image ${i + 1} of ${files.length}…`);
      const f = files[i];
      const img = await PF.loadImage(await PF.readAsDataURL(f));
      const ow = img.naturalWidth, oh = img.naturalHeight;

      let w = tw || ow, h = th || oh;
      if (locked) {
        if (tw && !th) h = Math.round(tw / (ow / oh));
        else if (th && !tw) w = Math.round(th * (ow / oh));
        else if (tw && th) h = Math.round(tw / (ow / oh));
      }
      if (!allowUp && w > ow) { const k = ow / w; w = ow; h = Math.round(h * k); }

      const c = document.createElement('canvas');
      c.width = Math.max(1, w); c.height = Math.max(1, h);
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      const isPng = /png$/i.test(f.type) || /\.png$/i.test(f.name);
      if (!isPng) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
      ctx.drawImage(img, 0, 0, c.width, c.height);

      const blob = await canvasToBlob(c, isPng ? 'image/png' : 'image/jpeg', 0.92);
      const ext = isPng ? 'png' : 'jpg';
      out.push({ name: `${PF.base(f.name)}-${c.width}x${c.height}.${ext}`, blob, w: c.width, h: c.height });
      c.width = c.height = 0;
    }

    if (out.length === 1) PF.save(out[0].blob, out[0].name);
    else {
      setStatus(status, 'working', 'Packaging…');
      PF.save(await makeZip(out), 'resized-images.zip');
    }

    const s = NetGuard.stats();
    const first = out[0];
    result.className = 'result show';
    result.innerHTML = `<h3>${out.length} image${out.length === 1 ? '' : 's'} resized</h3>
      <p>New size${out.length > 1 ? 's' : ''}: <strong>${out.map(o => o.w + '×' + o.h).slice(0, 4).join(', ')}${out.length > 4 ? '…' : ''}</strong></p>
      ${!allowUp ? '<p class="small">Targets larger than the original were capped at the original size, since enlarging cannot add detail.</p>' : ''}
      <p class="small"><strong>Privacy check:</strong> files uploaded: <strong>${s.fileDataRequests}</strong>.</p>`;
    clearStatus(status);
  } catch (err) {
    setStatus(status, 'err', err.message || String(err));
  }
}

draw();
