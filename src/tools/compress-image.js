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

  const q = document.createElement('div');
  q.className = 'field';
  q.innerHTML = `<label for="q">Quality — <span id="qv">80</span>%</label>
    <input id="q" type="range" min="20" max="95" value="80" style="width:220px">`;
  controls.appendChild(q);
  q.querySelector('#q').addEventListener('input', e => {
    document.getElementById('qv').textContent = e.target.value;
  });

  const dim = document.createElement('div');
  dim.className = 'field';
  dim.innerHTML = `<label for="maxw">Max width (px, optional)</label>
    <input id="maxw" type="number" min="0" placeholder="leave blank to keep" style="width:190px">`;
  controls.appendChild(dim);

  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.textContent = `Compress ${files.length} image${files.length === 1 ? '' : 's'}`;
  btn.onclick = run;
  controls.appendChild(btn);
}

async function run() {
  const quality = parseInt(document.getElementById('q').value, 10) / 100;
  const maxw = parseInt(document.getElementById('maxw').value, 10) || 0;

  try {
    const out = [];
    let before = 0, after = 0;

    for (let i = 0; i < files.length; i++) {
      setStatus(status, 'working', `Compressing image ${i + 1} of ${files.length}…`);
      const f = files[i];
      before += f.size;

      const url = await PF.readAsDataURL(f);
      const img = await PF.loadImage(url);
      let w = img.naturalWidth, h = img.naturalHeight;
      if (maxw && w > maxw) { h = Math.round(h * (maxw / w)); w = maxw; }

      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      // Flatten transparency onto white for JPG output.
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      const blob = await canvasToBlob(c, 'image/jpeg', quality);
      after += blob.size;
      out.push({ name: `${PF.base(f.name)}-compressed.jpg`, blob });
    }

    if (out.length === 1) PF.save(out[0].blob, out[0].name);
    else {
      setStatus(status, 'working', 'Packaging…');
      PF.save(await makeZip(out), 'compressed-images.zip');
    }

    const pct = before ? Math.round((1 - after / before) * 100) : 0;
    const s = NetGuard.stats();
    result.className = 'result show';
    result.innerHTML = `<h3>${out.length} image${out.length === 1 ? '' : 's'} compressed${pct > 0 ? ` — ${pct}% smaller` : ''}</h3>
      <p>${PF.fmtBytes(before)} → <strong>${PF.fmtBytes(after)}</strong></p>
      <p class="small">Texture note: images with transparency had it filled with white, because the output is JPG.</p>
      <p class="small"><strong>Privacy check:</strong> files uploaded: <strong>${s.fileDataRequests}</strong>.</p>`;
    clearStatus(status);
  } catch (err) {
    setStatus(status, 'err', err.message || String(err));
  }
}

draw();
