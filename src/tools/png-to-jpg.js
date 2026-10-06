import { canvasToBlob, makeZip, getTesseract } from './lib.js';

let files = [];
const dz = document.getElementById('dz');
const input = document.getElementById('file');
const list = document.getElementById('list');
const controls = document.getElementById('controls');
const status = document.getElementById('status');
const result = document.getElementById('result');

initDropzone({ zone: dz, input, multiple: false, onFiles: fs => { files = fs.slice(0, 1); draw(); clearStatus(status); result.className = 'result'; } });

function draw() {
  renderFileList(list, files, () => { files = []; draw(); });
  controls.innerHTML = '';
  if (!files.length) return;

  const bg = document.createElement('div');
  bg.className = 'field';
  bg.innerHTML = `<label for="bg">Background for transparency</label>
    <select id="bg">
      <option value="#ffffff">White</option>
      <option value="#000000">Black</option>
      <option value="#f3f4f6">Light grey</option>
    </select>`;
  controls.appendChild(bg);

  const q = document.createElement('div');
  q.className = 'field';
  q.innerHTML = `<label for="q">Quality — <span id="qv">90</span>%</label>
    <input id="q" type="range" min="40" max="100" value="90" style="width:200px">`;
  controls.appendChild(q);
  q.querySelector('#q').addEventListener('input', e => document.getElementById('qv').textContent = e.target.value);

  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.textContent = 'Convert to JPG';
  btn.onclick = run;
  controls.appendChild(btn);
}

async function run() {
  const bg = document.getElementById('bg').value;
  const quality = parseInt(document.getElementById('q').value, 10) / 100;

  try {
    const out = [];
    let before = 0, after = 0;

    for (let i = 0; i < files.length; i++) {
      setStatus(status, 'working', `Converting ${i + 1} of ${files.length}…`);
      const f = files[i];
      before += f.size;

      const img = await PF.loadImage(await PF.readAsDataURL(f));
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext('2d');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0);

      const blob = await canvasToBlob(c, 'image/jpeg', quality);
      after += blob.size;
      out.push({ name: `${PF.base(f.name)}.jpg`, blob });
      c.width = c.height = 0;
    }

    if (out.length === 1) PF.save(out[0].blob, out[0].name);
    else {
      setStatus(status, 'working', 'Packaging…');
      PF.save(await makeZip(out), 'converted-jpgs.zip');
    }

    const s = NetGuard.stats();
    const delta = before > 0 ? Math.round((1 - after / before) * 100) : 0;
    result.className = 'result show';
    result.innerHTML = `<h3>${out.length} file${out.length === 1 ? '' : 's'} converted to JPG</h3>
      <p>${PF.fmtBytes(before)} → <strong>${PF.fmtBytes(after)}</strong>${delta > 0 ? ` (${delta}% smaller)` : ''}</p>
      <p class="small">Transparent areas were filled with <code>${bg}</code>. PNG keeps transparency; JPG cannot.</p>
      <p class="small"><strong>Privacy check:</strong> files uploaded: <strong>${s.fileDataRequests}</strong>.</p>`;
    clearStatus(status);
  } catch (err) {
    setStatus(status, 'err', err.message || String(err));
  }
}

draw();
