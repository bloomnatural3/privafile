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

function draw() {
  renderFileList(list, file ? [file] : [], () => { file = null; img = null; draw(); });
  controls.innerHTML = '';
  if (!file) return;

  const t = document.createElement('div');
  t.className = 'field';
  t.innerHTML = `<label for="target">Target maximum size (KB)</label>
    <input id="target" type="number" min="5" max="50000" value="100" style="width:150px">`;
  controls.appendChild(t);

  const preset = document.createElement('div');
  preset.className = 'field';
  preset.innerHTML = `<label for="preset">Common limits</label>
    <select id="preset">
      <option value="">Custom…</option>
      <option value="50">50 KB</option>
      <option value="100" selected>100 KB</option>
      <option value="200">200 KB</option>
      <option value="500">500 KB</option>
      <option value="1024">1 MB</option>
      <option value="2048">2 MB</option>
    </select>`;
  controls.appendChild(preset);
  preset.querySelector('#preset').addEventListener('change', e => {
    if (e.target.value) document.getElementById('target').value = e.target.value;
  });

  const shrink = document.createElement('div');
  shrink.className = 'field';
  shrink.innerHTML = `<label for="shrink">If size alone is not enough</label>
    <select id="shrink">
      <option value="1">Also reduce dimensions (recommended)</option>
      <option value="0">Quality only — keep dimensions</option>
    </select>`;
  controls.appendChild(shrink);

  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.textContent = 'Compress to target';
  btn.onclick = run;
  controls.appendChild(btn);

  if (img) {
    const info = document.createElement('span');
    info.className = 'small muted';
    info.textContent = `Source: ${img.naturalWidth}×${img.naturalHeight}, ${PF.fmtBytes(file.size)}`;
    controls.appendChild(info);
  }
}

/**
 * Find the highest JPEG quality whose output fits the byte budget, then, if the
 * target is still unreachable and the caller allowed it, scale the dimensions
 * down in steps and retry. Returns { blob, quality, scale }.
 */
async function fitToTarget(quality, scale) {
  const budget = targetBytes;
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  // Binary search on quality between 0.30 and 0.95.
  let lo = 0.30, hi = 0.95, best = null, bestQ = lo;
  for (let i = 0; i < 7; i++) {
    const mid = (lo + hi) / 2;
    const blob = await canvasToBlob(canvas, 'image/jpeg', mid);
    if (blob.size <= budget) { best = blob; bestQ = mid; lo = mid; }
    else { hi = mid; }
    if (hi - lo < 0.02) break;
  }
  if (!best) {
    // Even minimum quality is over budget at this scale: take the smallest we saw.
    best = await canvasToBlob(canvas, 'image/jpeg', 0.30);
    bestQ = 0.30;
  }
  canvas.width = canvas.height = 0;
  return { blob: best, quality: bestQ, scale, w, h };
}

let targetBytes = 100 * 1024;

async function run() {
  targetBytes = Math.max(5, parseInt(document.getElementById('target').value, 10) || 100) * 1024;
  const allowShrink = document.getElementById('shrink').value === '1';
  const btn = controls.querySelector('button');

  try {
    btn.disabled = true;
    if (file.size <= targetBytes) {
      setStatus(status, 'ok', `Your file is already ${PF.fmtBytes(file.size)}, under the ${PF.fmtBytes(targetBytes)} target. No compression needed.`);
      btn.disabled = false;
      return;
    }

    // If the original is PNG with transparency, warn that JPG output loses it.
    const wasPng = /png$/i.test(file.type) || /\.png$/i.test(file.name);

    let scale = 1;
    let attempt = 0;
    let outcome = null;

    while (attempt < 6) {
      setStatus(status, 'working', `Trying ${Math.round(scale * 100)}% dimensions (attempt ${attempt + 1})…`);
      outcome = await fitToTarget(null, scale);
      if (outcome.blob.size <= targetBytes) break;
      if (!allowShrink) break;
      scale *= 0.85;
      attempt++;
    }

    const got = outcome.blob.size;
    const met = got <= targetBytes;
    PF.save(outcome.blob, `${PF.base(file.name)}-${Math.round(got / 1024)}kb.jpg`);

    const s = NetGuard.stats();
    result.className = 'result show';
    result.innerHTML = `<h3>${met ? 'Target met' : 'Closest achievable'}</h3>
      <p>${PF.fmtBytes(file.size)} → <strong>${PF.fmtBytes(got)}</strong> (target ${PF.fmtBytes(targetBytes)})</p>
      <p class="small">Quality ${Math.round(outcome.quality * 100)}% · dimensions ${outcome.w}×${outcome.h} (${Math.round(outcome.scale * 100)}% of original)</p>
      ${!met ? `<p class="small"><strong>Could not reach the target.</strong> The smallest file this tool could produce at 30% quality is ${PF.fmtBytes(got)}. Try a smaller target with dimension reduction enabled, or start from a smaller source image.</p>` : ''}
      ${wasPng ? `<p class="small">Your source was a PNG, and the output is JPG. Any transparency was filled with white, because JPG cannot store it.</p>` : ''}
      <p class="small"><strong>Privacy check:</strong> files uploaded: <strong>${s.fileDataRequests}</strong>. The search ran ${attempt + 1} passes, all in memory.</p>`;
    clearStatus(status);
    btn.disabled = false;
  } catch (err) {
    setStatus(status, 'err', err.message || String(err));
    btn.disabled = false;
  }
}

draw();
