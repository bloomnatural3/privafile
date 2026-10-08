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

  const rot = document.createElement('div');
  rot.className = 'field';
  rot.innerHTML = `<label for="rot">Rotation</label>
    <select id="rot">
      <option value="0">None</option>
      <option value="90">90° clockwise</option>
      <option value="180">180°</option>
      <option value="270">90° anticlockwise</option>
    </select>`;
  controls.appendChild(rot);

  const flip = document.createElement('div');
  flip.className = 'field';
  flip.innerHTML = `<label for="flip">Flip</label>
    <select id="flip">
      <option value="none">None</option>
      <option value="h">Horizontal (mirror left/right)</option>
      <option value="v">Vertical (mirror top/bottom)</option>
    </select>`;
  controls.appendChild(flip);

  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.textContent = `Apply to ${files.length} image${files.length === 1 ? '' : 's'}`;
  btn.onclick = run;
  controls.appendChild(btn);
}

async function run() {
  const deg = parseInt(document.getElementById('rot').value, 10);
  const flip = document.getElementById('flip').value;

  if (!deg && flip === 'none') {
    setStatus(status, 'err', 'Choose a rotation, a flip, or both.');
    return;
  }

  try {
    const out = [];
    for (let i = 0; i < files.length; i++) {
      setStatus(status, 'working', `Processing ${i + 1} of ${files.length}…`);
      const f = files[i];
      const img = await PF.loadImage(await PF.readAsDataURL(f));
      const w = img.naturalWidth, h = img.naturalHeight;

      // At right angles the canvas swaps dimensions.
      const swap = deg === 90 || deg === 270;
      const c = document.createElement('canvas');
      c.width = swap ? h : w;
      c.height = swap ? w : h;
      const ctx = c.getContext('2d');

      const isPng = /png$/i.test(f.type) || /\.png$/i.test(f.name);
      if (!isPng) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }

      ctx.translate(c.width / 2, c.height / 2);
      ctx.rotate(deg * Math.PI / 180);
      if (flip === 'h') ctx.scale(-1, 1);
      if (flip === 'v') ctx.scale(1, -1);
      ctx.drawImage(img, -w / 2, -h / 2);

      const blob = await canvasToBlob(c, isPng ? 'image/png' : 'image/jpeg', 0.92);
      const ext = isPng ? 'png' : 'jpg';
      out.push({ name: `${PF.base(f.name)}-rotated.${ext}`, blob, w: c.width, h: c.height });
      c.width = c.height = 0;
    }

    if (out.length === 1) PF.save(out[0].blob, out[0].name);
    else { setStatus(status, 'working', 'Packaging…'); PF.save(await makeZip(out), 'rotated-images.zip'); }

    const s = NetGuard.stats();
    result.className = 'result show';
    result.innerHTML = `<h3>${out.length} image${out.length === 1 ? '' : 's'} adjusted</h3>
      <p>New dimensions: <strong>${out.map(o => o.w + '×' + o.h).slice(0, 4).join(', ')}${out.length > 4 ? '…' : ''}</strong></p>
      <p class="small">Applied: ${deg ? deg + '° rotation' : 'no rotation'}${flip !== 'none' ? `, ${flip === 'h' ? 'horizontal' : 'vertical'} flip` : ''}.</p>
      <p class="small"><strong>Privacy check:</strong> files uploaded: <strong>${s.fileDataRequests}</strong>.</p>`;
    clearStatus(status);
  } catch (err) {
    setStatus(status, 'err', err.message || String(err));
  }
}

draw();
