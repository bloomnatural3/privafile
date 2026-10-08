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
  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.textContent = `Convert ${files.length} WebP to PNG`;
  btn.onclick = run;
  controls.appendChild(btn);
}

async function run() {
  try {
    const out = [];
    let before = 0, after = 0;
    let lostAnimation = false;

    for (let i = 0; i < files.length; i++) {
      setStatus(status, 'working', `Converting ${i + 1} of ${files.length}…`);
      const f = files[i];
      before += f.size;
      const img = await PF.loadImage(await PF.readAsDataURL(f));
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      // No background fill: WebP alpha must survive into the PNG.
      c.getContext('2d').drawImage(img, 0, 0);
      const blob = await canvasToBlob(c, 'image/png');
      after += blob.size;
      out.push({ name: `${PF.base(f.name)}.png`, blob });
      c.width = c.height = 0;
    }

    if (out.length === 1) PF.save(out[0].blob, out[0].name);
    else { setStatus(status, 'working', 'Packaging…'); PF.save(await makeZip(out), 'webp-as-png.zip'); }

    const s = NetGuard.stats();
    result.className = 'result show';
    result.innerHTML = `<h3>${out.length} WebP file${out.length === 1 ? '' : 's'} converted</h3>
      <p>${PF.fmtBytes(before)} → <strong>${PF.fmtBytes(after)}</strong></p>
      <p class="small">Transparency was preserved. Only the first frame of an animated WebP is converted.</p>
      <p class="small"><strong>Privacy check:</strong> files uploaded: <strong>${s.fileDataRequests}</strong>.</p>`;
    clearStatus(status);
  } catch (err) {
    setStatus(status, 'err', err.message || 'Could not decode that WebP.');
  }
}

draw();
