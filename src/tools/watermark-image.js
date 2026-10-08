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

  const text = document.createElement('div');
  text.className = 'field';
  text.innerHTML = `<label for="wm">Watermark text</label>
    <input id="wm" type="text" value="© Your Name" style="min-width:240px" maxlength="80">`;
  controls.appendChild(text);

  const pos = document.createElement('div');
  pos.className = 'field';
  pos.innerHTML = `<label for="pos">Position</label>
    <select id="pos">
      <option value="br">Bottom right</option>
      <option value="bl">Bottom left</option>
      <option value="tr">Top right</option>
      <option value="tl">Top left</option>
      <option value="c">Centre</option>
      <option value="tile">Tiled across the image</option>
    </select>`;
  controls.appendChild(pos);

  const size = document.createElement('div');
  size.className = 'field';
  size.innerHTML = `<label for="size">Size (% of image height)</label>
    <input id="size" type="number" value="5" min="2" max="30" style="width:90px">`;
  controls.appendChild(size);

  const opacity = document.createElement('div');
  opacity.className = 'field';
  opacity.innerHTML = `<label for="op">Opacity (%)</label>
    <input id="op" type="number" value="55" min="5" max="100" style="width:90px">`;
  controls.appendChild(opacity);

  const colour = document.createElement('div');
  colour.className = 'field';
  colour.innerHTML = `<label for="col">Colour</label>
    <select id="col">
      <option value="white">White</option>
      <option value="black">Black</option>
      <option value="grey">Grey</option>
    </select>`;
  controls.appendChild(colour);

  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.textContent = `Watermark ${files.length} image${files.length === 1 ? '' : 's'}`;
  btn.onclick = run;
  controls.appendChild(btn);
}

async function run() {
  const text = (document.getElementById('wm').value || '').trim();
  const pos = document.getElementById('pos').value;
  const pct = Math.min(30, Math.max(2, parseFloat(document.getElementById('size').value) || 5));
  const alpha = Math.min(100, Math.max(5, parseFloat(document.getElementById('op').value) || 55)) / 100;
  const colour = document.getElementById('col').value;

  if (!text) { setStatus(status, 'err', 'Enter the watermark text first.'); return; }

  const rgb = colour === 'black' ? '0,0,0' : colour === 'grey' ? '128,128,128' : '255,255,255';
  const out = [];

  try {
    for (let i = 0; i < files.length; i++) {
      setStatus(status, 'working', `Watermarking ${i + 1} of ${files.length}…`);
      const f = files[i];
      const img = await PF.loadImage(await PF.readAsDataURL(f));
      const w = img.naturalWidth, h = img.naturalHeight;

      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const fontSize = Math.max(10, Math.round(h * pct / 100));
      ctx.font = `600 ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
      ctx.fillStyle = `rgba(${rgb},${alpha})`;
      ctx.textBaseline = 'alphabetic';

      const pad = Math.round(h * 0.025);

      if (pos === 'tile') {
        const stepX = ctx.measureText(text).width + fontSize * 3;
        const stepY = fontSize * 4;
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.rotate(-Math.PI / 9);
        ctx.translate(-w / 2, -h / 2);
        for (let y = -h; y < h * 2; y += stepY) {
          for (let x = -w; x < w * 2; x += stepX) ctx.fillText(text, x, y);
        }
        ctx.restore();
      } else {
        const tw = ctx.measureText(text).width;
        let x, y;
        if (pos === 'tl') { x = pad; y = pad + fontSize; }
        else if (pos === 'tr') { x = w - tw - pad; y = pad + fontSize; }
        else if (pos === 'bl') { x = pad; y = h - pad; }
        else if (pos === 'c') { x = (w - tw) / 2; y = (h + fontSize) / 2; }
        else { x = w - tw - pad; y = h - pad; }

        // Soft dark shadow so light text survives a light background.
        ctx.save();
        ctx.fillStyle = `rgba(0,0,0,${alpha * 0.45})`;
        ctx.fillText(text, x + Math.max(1, fontSize / 14), y + Math.max(1, fontSize / 14));
        ctx.restore();
        ctx.fillStyle = `rgba(${rgb},${alpha})`;
        ctx.fillText(text, x, y);
      }

      const isPng = /png$/i.test(f.type) || /\.png$/i.test(f.name);
      const blob = await canvasToBlob(c, isPng ? 'image/png' : 'image/jpeg', isPng ? undefined : 0.92);
      out.push({ name: `${PF.base(f.name)}-watermarked.${isPng ? 'png' : 'jpg'}`, blob });
      c.width = c.height = 0;
    }

    if (out.length === 1) PF.save(out[0].blob, out[0].name);
    else { setStatus(status, 'working', 'Packaging…'); PF.save(await makeZip(out), 'watermarked-images.zip'); }

    const s = NetGuard.stats();
    result.className = 'result show';
    result.innerHTML = `<h3>${out.length} image${out.length === 1 ? '' : 's'} watermarked</h3>
      <p>Text: <strong>${text.replace(/</g, '&lt;')}</strong> · position: <strong>${pos === 'tile' ? 'tiled' : pos.toUpperCase()}</strong> · opacity: <strong>${Math.round(alpha * 100)}%</strong></p>
      <p class="small muted">A watermark is drawn into the pixels, so it survives most casual copying. It is not a security measure — someone determined can crop or paint over it.</p>
      <p class="small"><strong>Privacy check:</strong> files uploaded: <strong>${s.fileDataRequests}</strong>.</p>`;
    clearStatus(status);
  } catch (err) {
    setStatus(status, 'err', err.message || String(err));
  }
}

draw();
