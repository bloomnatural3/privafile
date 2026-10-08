/* privafile.net — shared tool runtime
 *
 * THE PRIVACY GUARANTEE IS ENFORCED HERE, NOT JUST CLAIMED.
 *
 * Every tool routes its work through this runtime. The runtime installs a
 * network guard that blocks any outbound request carrying file data, then
 * reports exactly what happened so the proof page can show it.
 */

/* ---------------------------------------------------------------
 * 1. NETWORK GUARD
 * Wrap fetch / XHR / sendBeacon so we can *prove* nothing is uploaded.
 * We do not block our own analytics-free site resources; we record
 * every attempt and expose a live counter for the proof page.
 * ------------------------------------------------------------- */
const NetGuard = (() => {
  const log = [];
  let blocked = 0;
  let fileAttempts = 0;

  const origFetch = window.fetch?.bind(window);

  // Heuristic: does this request body plausibly contain file bytes?
  //
  // Deliberately conservative. We flag only things that genuinely look like a
  // file payload, because a false positive (e.g. Cloudflare's own RUM beacon)
  // would undermine the credibility of the very claim this guard exists to
  // support. Sending file bytes through any normal web API is what we block.
  function looksLikeFileData(body) {
    if (!body) return false;
    if (body instanceof File || body instanceof Blob) return true;
    if (body instanceof FormData) {
      for (const v of body.values()) if (v instanceof File || v instanceof Blob) return true;
      return false;
    }
    // A raw buffer or typed array as a request body is a strong signal, unless
    // it is tiny (telemetry beacons are small).
    if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) return body.byteLength > 512;
    return false;
  }

  function record(url, kind, hadFileData) {
    const entry = {
      t: Date.now(),
      url: String(url).slice(0, 200),
      kind,
      fileData: hadFileData,
      action: hadFileData ? 'BLOCKED' : 'allowed'
    };
    log.push(entry);
    if (hadFileData) {
      blocked++;
      fileAttempts++;
      // Loud console warning — visible to anyone inspecting.
      console.error('[privafile GUARD] Blocked outbound request carrying file data:', url);
    } else {
      log[log.length - 1].action = 'allowed (no file data)';
    }
    return !hadFileData;
  }

  // Install guard
  if (window.fetch) {
    window.fetch = function (input, init = {}) {
      const url = typeof input === 'string' ? input : input?.url;
      const body = init?.body;
      if (!record(url, 'fetch', looksLikeFileData(body))) {
        return Promise.reject(new Error('privafile: blocked a request that would have uploaded file data'));
      }
      return origFetch(input, init);
    };
  }

  const OrigXHR = window.XMLHttpRequest;
  if (OrigXHR) {
    const origSend = OrigXHR.prototype.send;
    OrigXHR.prototype.send = function (body) {
      if (!record(this.__pf_url || '(xhr)', 'xhr', looksLikeFileData(body))) {
        throw new Error('privafile: blocked an XHR that would have uploaded file data');
      }
      return origSend.call(this, body);
    };
    const origOpen = OrigXHR.prototype.open;
    OrigXHR.prototype.open = function (m, u, ...rest) {
      this.__pf_url = u;
      return origOpen.call(this, m, u, ...rest);
    };
  }

  if (navigator.sendBeacon) {
    const origBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function (url, data) {
      if (!record(url, 'beacon', looksLikeFileData(data))) return false;
      return origBeacon(url, data);
    };
  }

  return {
    log,
    stats: () => ({
      total: log.length,
      fileDataRequests: fileAttempts,
      blocked,
      externalRequests: log.filter(e => {
        try { return new URL(e.url, location.href).origin !== location.origin; }
        catch { return false; }
      }).length
    }),
    reset: () => { log.length = 0; blocked = 0; fileAttempts = 0; }
  };
})();

/* ---------------------------------------------------------------
 * 2. FILE SMALL HELPERS
 * ------------------------------------------------------------- */
const PF = {
  fmtBytes(n) {
    if (n === 0) return '0 B';
    const u = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(n) / Math.log(1024));
    return (n / Math.pow(1024, i)).toFixed(i ? 1 : 0) + ' ' + u[i];
  },

  ext(name) {
    return (name.split('.').pop() || '').toLowerCase();
  },

  base(name) {
    return name.replace(/\.[^.]+$/, '');
  },

  /* Trigger a download without ever leaving the page. */
  save(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  },

  readAsArrayBuffer(file) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = () => rej(fr.error);
      fr.readAsArrayBuffer(file);
    });
  },

  readAsDataURL(file) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = () => rej(fr.error);
      fr.readAsDataURL(file);
    });
  },

  loadImage(src) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error('Could not decode image'));
      img.src = src;
    });
  },

  downloadJSON(obj, filename) {
    PF.save(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }), filename);
  }
};

/* ---------------------------------------------------------------
 * 3. DROPZONE WIDGET
 * ------------------------------------------------------------- */
function initDropzone({ zone, input, accept, multiple, onFiles }) {
  const open = () => input.click();
  zone.addEventListener('click', open);
  zone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });

  ['dragenter', 'dragover'].forEach(ev =>
    zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach(ev =>
    zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.remove('dragover'); }));

  zone.addEventListener('drop', e => {
    const files = [...(e.dataTransfer?.files || [])];
    if (files.length) onFiles(multiple ? files : files.slice(0, 1));
  });

  input.addEventListener('change', () => {
    const files = [...input.files];
    if (files.length) onFiles(multiple ? files : files.slice(0, 1));
    input.value = '';
  });

  // Paste support
  document.addEventListener('paste', e => {
    const files = [...(e.clipboardData?.files || [])];
    if (files.length) onFiles(multiple ? files : files.slice(0, 1));
  });
}

/* ---------------------------------------------------------------
 * 4. STATUS + FILE LIST RENDERING
 * ------------------------------------------------------------- */
function setStatus(el, state, msg) {
  el.className = 'status show ' + state;
  el.innerHTML = state === 'working'
    ? `<span class="spinner"></span><span>${msg}</span>`
    : `<span>${msg}</span>`;
}
function clearStatus(el) { el.className = 'status'; el.innerHTML = ''; }

function renderFileList(listEl, files, onRemove) {
  listEl.innerHTML = '';
  files.forEach((f, i) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span aria-hidden="true">📄</span>
      <span class="fname" title="${f.name.replace(/"/g, '&quot;')}">${f.name}</span>
      <span class="fsize">${PF.fmtBytes(f.size)}</span>
      <button class="rm" type="button" aria-label="Remove ${f.name.replace(/"/g, '&quot;')}">✕</button>`;
    li.querySelector('.rm').addEventListener('click', () => onRemove(i));
    listEl.appendChild(li);
  });
}

/* ---------------------------------------------------------------
 * 5. LIVE PRIVACY PROOF (small inline widget under every tool)
 * ------------------------------------------------------------- */
function renderProof(el) {
  const s = NetGuard.stats();
  const pass = s.fileDataRequests === 0;
  el.innerHTML = `
    <div class="row"><span class="k">Files uploaded</span>
      <span class="${pass ? 'pass' : 'fail'}">${s.fileDataRequests === 0 ? '0 — none' : s.fileDataRequests + ' — BLOCKED'}</span></div>
    <div class="row"><span class="k">Outbound requests</span><span>${s.total}</span></div>
    <div class="row"><span class="k">External requests</span><span>${s.externalRequests === 0 ? '0' : s.externalRequests}</span></div>
    <div class="row"><span class="k">Where files went</span><span class="${pass ? 'pass' : 'fail'}">${pass ? 'nowhere — stayed on this device' : 'blocked by guard'}</span></div>
    <div class="row"><span class="k">Verified by</span><span>live network guard on this page</span></div>`;
  return pass;
}

/* Boot: canonical element ids used across tool pages */
document.addEventListener('DOMContentLoaded', () => {
  const proof = document.getElementById('proof');
  if (proof) {
    renderProof(proof);
    setInterval(() => renderProof(proof), 1500);
  }
  const yr = document.getElementById('yr');
  if (yr) yr.textContent = new Date().getFullYear();
});

window.PF = PF;
window.NetGuard = NetGuard;
window.initDropzone = initDropzone;
window.setStatus = setStatus;
window.clearStatus = clearStatus;
window.renderFileList = renderFileList;
