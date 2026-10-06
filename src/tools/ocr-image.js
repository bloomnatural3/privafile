import { getTesseract } from './lib.js';

let file = null;
const dz = document.getElementById('dz');
const input = document.getElementById('file');
const list = document.getElementById('list');
const controls = document.getElementById('controls');
const status = document.getElementById('status');
const result = document.getElementById('result');

initDropzone({ zone: dz, input, multiple: false, onFiles: fs => { file = fs[0]; draw(); clearStatus(status); result.className = 'result'; } });

const LANGS = [
  ['eng', 'English'],
  ['ara', 'Arabic'],
  ['fra', 'French'],
  ['deu', 'German'],
  ['spa', 'Spanish'],
  ['ita', 'Italian'],
  ['hin', 'Hindi'],
  ['urd', 'Urdu']
];

function draw() {
  renderFileList(list, file ? [file] : [], () => { file = null; draw(); });
  controls.innerHTML = '';
  if (!file) return;

  const lf = document.createElement('div');
  lf.className = 'field';
  lf.innerHTML = `<label for="lang">Language</label>
    <select id="lang">${LANGS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>`;
  controls.appendChild(lf);

  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.textContent = 'Extract text';
  btn.onclick = run;
  controls.appendChild(btn);
}

async function run() {
  const lang = document.getElementById('lang').value;
  const btn = controls.querySelector('button');

  try {
    btn.disabled = true;
    setStatus(status, 'working', 'Loading the recognition model — first run takes a moment…');

    const Tesseract = await getTesseract();
    const url = await PF.readAsDataURL(file);

    const worker = await Tesseract.createWorker(lang, 1, {
      logger: m => {
        if (m.status === 'recognizing text') {
          setStatus(status, 'working', `Reading the image — ${Math.round((m.progress || 0) * 100)}%`);
        } else if (m.status && m.progress !== undefined) {
          setStatus(status, 'working', `${m.status.replace(/_/g, ' ')} — ${Math.round(m.progress * 100)}%`);
        }
      }
    });

    const { data } = await worker.recognize(url);
    await worker.terminate();

    const text = (data.text || '').trim();
    const conf = Math.round(data.confidence || 0);

    if (!text) {
      setStatus(status, 'err', 'No text was found. Try a sharper, straighter, higher-contrast image.');
      btn.disabled = false;
      return;
    }

    PF.save(new Blob([text], { type: 'text/plain' }), `${PF.base(file.name)}.txt`);

    const s = NetGuard.stats();
    const safe = text.replace(/</g, '&lt;');
    result.className = 'result show';
    result.innerHTML = `<h3>Text extracted — ${text.split(/\s+/).filter(Boolean).length.toLocaleString()} words</h3>
      <p class="small">Confidence: <strong>${conf}%</strong> · saved as <code>${PF.base(file.name)}.txt</code></p>
      <p class="small">Proofread anything important. Handwriting, skew and low light reduce accuracy.</p>
      <textarea readonly style="width:100%;min-height:220px;margin-top:12px;padding:12px;border:1px solid #c3d3c9;border-radius:8px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.86rem">${safe}</textarea>
      <p class="small" style="margin-top:10px"><strong>Privacy check:</strong> files uploaded: <strong>${s.fileDataRequests}</strong> — the image was never transmitted.</p>`;
    clearStatus(status);
    btn.disabled = false;
  } catch (err) {
    setStatus(status, 'err', err.message || String(err));
    btn.disabled = false;
  }
}

draw();
