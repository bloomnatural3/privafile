// Bridge the ESM worker module into a CJS test without a build step.
// The worker file uses `export default { ... }`; we rewrite that to a
// module.exports assignment and run it, then expose it as `.default` so the
// test reads the same shape Cloudflare sees.
const fs = require('fs');
const path = require('path');

let src = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
src = src.replace('export default {', 'const __worker = {');
src += '\nmodule.exports.default = __worker;\n';
src += 'module.exports.shouldSkip = shouldSkip;\n';
src += 'module.exports.normalise = normalise;\n';

const m = { exports: {} };
const fn = new Function('module', 'exports', 'crypto', 'TextEncoder', 'Response', 'Request', 'URL', 'Date', 'parseInt', 'Promise',
  src);
fn(m, m.exports, globalThis.crypto, TextEncoder, Response, Request, URL, Date, parseInt, Promise);
module.exports = m.exports;
