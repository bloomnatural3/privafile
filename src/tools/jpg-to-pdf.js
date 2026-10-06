import { getPdfLib } from './lib.js';

let files = [];
const dz = document.getElementById('dz');
const input = document.getElementById('file');
const list = document.getElementById('list');
const controls = document.getElementById('controls');
const status = document.getElementById('status');
const result = document.getElementById('result');

initDropzone({ zone: dz, input, multiple: true, onFiles: fs => { files = files.concat(fs); draw(); clearStatus(status); result.className = 'result'; } });

const SIZES = { A4: [595.28, 841.89], Letter: [612, 792], fit: null };

function draw() {
  renderFileList(list, files, i => { files.splice(i, 1); draw(); });
  controls.innerHTML = '';
  if (!files.length) return;

  const size = document.createElement('div');
  size.className = 'field';
  size.innerHTML = `<label for="size">Page size</label>
    <select id="size">
      <option value="A4">A4 (210 × 297 mm)</option>
      <option value="Letter">Letter (8.5 × 11 in)</option>
      <option value="fit">Fit page to image</option>
    </select>`;
  controls.appendChild(size);

  const margin = document.createElement('div');
  margin.className = 'field';
  margin.innerHTML = `<label for="margin">Margin</label>
    <select id="margin">
      <option value="0">None</option>
      <option value="20" selected>Small (20 pt)</option>
      <option value="40">Medium (40 pt)</option>
    </select>`;
  controls.appendChild(margin);

  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.textContent = `Create PDF from ${files.length} image${files.length === 1 ? '' : 's'}`;
  btn.onclick = run;
  controls.appendChild(btn);
}

async function run() {
  const { PDFDocument } = await getPdfLib();
  const sizeKey = document.getElementById('size').value;
  const margin = parseFloat(document.getElementById('margin').value);

  try {
    const doc = await PDFDocument.create();

    for (let i = 0; i < files.length; i++) {
      setStatus(status, 'working', `Adding image ${i + 1} of ${files.length}…`);
      const f = files[i];
      const dataUrl = await PF.readAsDataURL(f);
      const isPng = /png$/i.test(f.type) || /\.png$/i.test(f.name);
      const isJpg = /jpe?g$/i.test(f.type) || /\.jpe?g$/i.test(f.name);

      let img;
      if (isPng) img = await doc.embedPng(dataUrl);
      else if (isJpg) img = await doc.embedJpg(dataUrl);
      else {
        // WebP and anything else: re-encode via canvas to PNG.
        const el = await PF.loadImage(dataUrl);
        const c = document.createElement('canvas');
        c.width = el.naturalWidth; c.height = el.naturalHeight;
        c.getContext('2d').drawImage(el, 0, 0);
        const pngUrl = c.toDataURL('image/png');
        img = await doc.embedPng(pngUrl);
      }

      let pageW, pageH;
      const useFit = sizeKey === 'fit';
      if (useFit) {
        pageW = img.width + margin * 2;
        pageH = img.height + margin * 2;
      } else {
        [pageW, pageH] = SIZES[sizeKey];
      }

      const page = doc.addPage([pageW, pageH]);
      const availW = pageW - margin * 2;
      const availH = pageH - margin * 2;
      const s = useFit ? 1 : Math.min(availW / img.width, availH / img.height);
      const w = img.width * s, h = img.height * s;
      page.drawImage(img, { x: (pageW - w) / 2, y: (pageH - h) / 2, width: w, height: h });
    }

    setStatus(status, 'working', 'Saving the PDF…');
    const saved = await doc.save();
    const blob = new Blob([saved], { type: 'application/pdf' });
    const name = files.length === 1 ? `${PF.base(files[0].name)}.pdf` : 'images.pdf';
    PF.save(blob, name);

    const s = NetGuard.stats();
    result.className = 'result show';
    result.innerHTML = `<h3>PDF created — ${files.length} page${files.length === 1 ? '' : 's'}</h3>
      <p>${PF.fmtBytes(blob.size)} · saved as <code>${name}</code></p>
      <p class="small"><strong>Privacy check:</strong> files uploaded: <strong>${s.fileDataRequests}</strong>.</p>`;
    clearStatus(status);
  } catch (err) {
    setStatus(status, 'err', err.message || String(err));
  }
}

draw();
