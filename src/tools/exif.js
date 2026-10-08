/* Minimal EXIF reader — parses JPEG APP1 / TIFF IFD directly, no library.
 * We walk the TIFF header and the first IFD, then decode the handful of tags
 * people actually care about (camera, lens, exposure, date, GPS).
 * Everything happens on the ArrayBuffer in memory; nothing is uploaded. */

const TAGS = {
  0x010e: 'Image description',
  0x010f: 'Camera make',
  0x0110: 'Camera model',
  0x0112: 'Orientation',
  0x011a: 'X resolution',
  0x011b: 'Y resolution',
  0x0128: 'Resolution unit',
  0x0131: 'Software',
  0x0132: 'Date and time',
  0x013b: 'Artist',
  0x8298: 'Copyright',
  0x829a: 'Exposure time',
  0x829d: 'F-number',
  0x8822: 'Exposure program',
  0x8827: 'ISO',
  0x9003: 'Date taken',
  0x9004: 'Date digitised',
  0x9201: 'Shutter speed',
  0x9202: 'Aperture',
  0x9204: 'Exposure bias',
  0x9207: 'Metering mode',
  0x9209: 'Flash',
  0x920a: 'Focal length',
  0x9286: 'User comment',
  0xa001: 'Colour space',
  0xa002: 'Width',
  0xa003: 'Height',
  0xa405: 'Focal length (35mm)',
  0xa432: 'Lens specification',
  0xa433: 'Lens make',
  0xa434: 'Lens model',
};

const ORIENTATION = {
  1: 'Normal', 2: 'Mirrored horizontally', 3: 'Rotated 180°',
  4: 'Mirrored vertically', 5: 'Mirrored, rotated 90° CW',
  6: 'Rotated 90° CW', 7: 'Mirrored, rotated 90° CCW', 8: 'Rotated 90° CCW',
};
const FLASH = {
  0x00: 'No flash', 0x01: 'Flash fired', 0x05: 'Fired, return light not detected',
  0x07: 'Fired, return light detected', 0x09: 'Fired, compulsory',
  0x10: 'Did not fire, compulsory', 0x18: 'Did not fire, auto',
  0x19: 'Fired, auto', 0x20: 'No flash function',
};
const METERING = { 0: 'Unknown', 1: 'Average', 2: 'Centre-weighted', 3: 'Spot', 4: 'Multi-spot', 5: 'Pattern', 6: 'Partial' };

function typeSize(t) {
  return { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8, 11: 4, 12: 8 }[t] || 1;
}

function readValue(view, entryOffset, littleEndian, bytes, base) {
  const type = view.getUint16(entryOffset + 2, littleEndian);
  const count = view.getUint32(entryOffset + 4, littleEndian);
  const size = typeSize(type) * count;

  // Values of 4 bytes or fewer live inline in the entry itself.
  // Anything larger is stored elsewhere, at an offset measured from the
  // start of the TIFF header — so `base` must be added. Forgetting this
  // silently reads the wrong bytes and produces plausible-looking nonsense.
  let dataOffset = entryOffset + 8;
  if (size > 4) {
    dataOffset = base + view.getUint32(entryOffset + 8, littleEndian);
    if (dataOffset < 0 || dataOffset + size > bytes.byteLength) return null;
  }

  try {
    if (type === 2) { // ASCII
      let s = '';
      for (let i = 0; i < count - 1; i++) {
        const c = bytes.getUint8(dataOffset + i);
        if (c === 0) break;
        s += String.fromCharCode(c);
      }
      return s.replace(/\0+$/, '').trim() || null;
    }
    if (type === 3) return view.getUint16(dataOffset, littleEndian);
    if (type === 4) return view.getUint32(dataOffset, littleEndian);
    if (type === 5 || type === 10) { // rational
      const num = view.getUint32(dataOffset, littleEndian);
      const den = view.getUint32(dataOffset + 4, littleEndian);
      if (!den) return null;
      return { num, den, value: num / den };
    }
    if (type === 7) { // undefined — often the user comment
      const arr = [];
      for (let i = 0; i < Math.min(count, 64); i++) arr.push(bytes.getUint8(dataOffset + i));
      // Skip the 8-byte encoding prefix if it looks like one.
      const ascii = arr.slice(0, 8).every(b => b === 0 || b === 65) ? arr.slice(8) : arr;
      const txt = ascii.filter(b => b >= 32 && b < 127).map(b => String.fromCharCode(b)).join('');
      return txt.trim() || null;
    }
  } catch { /* fall through */ }
  return null;
}

function formatTag(tag, v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object' && v.value !== undefined) {
    const f = v.num / v.den;
    if (tag === 0x829a) return `${f >= 1 ? f + ' s' : '1/' + Math.round(1 / f) + ' s'}`;
    if (tag === 0x829d) return `f/${f.toFixed(1)}`;
    if (tag === 0x920a || tag === 0xa405) return `${Math.round(f)} mm`;
    if (tag === 0x9202) return `f/${Math.pow(2, f / 2).toFixed(1)}`;
    if (tag === 0x9204) return `${f > 0 ? '+' : ''}${f.toFixed(2)} EV`;
    return String(f.toFixed(3));
  }
  if (tag === 0x0112) return ORIENTATION[v] ? `${ORIENTATION[v]} (${v})` : String(v);
  if (tag === 0x9209) return FLASH[v] || String(v);
  if (tag === 0x9207) return METERING[v] || String(v);
  if (tag === 0x8822) return { 0: 'Not defined', 1: 'Manual', 2: 'Program', 3: 'Aperture priority', 4: 'Shutter priority', 5: 'Creative', 6: 'Action', 7: 'Portrait', 8: 'Landscape' }[v] || String(v);
  if (tag === 0x0128) return { 1: 'None', 2: 'inches', 3: 'cm' }[v] || String(v);
  if (tag === 0xa001) return v === 1 ? 'sRGB' : v === 65535 ? 'Uncalibrated' : String(v);
  return String(v);
}

/** Find the APP1/Exif segment in a JPEG and return its TIFF block. */
function findExifBlock(bytes) {
  if (bytes.byteLength < 4) return null;
  if (bytes.getUint8(0) !== 0xff || bytes.getUint8(1) !== 0xd8) return null; // not JPEG

  let off = 2;
  while (off + 4 < bytes.byteLength) {
    if (bytes.getUint8(off) !== 0xff) { off++; continue; }
    const marker = bytes.getUint8(off + 1);
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { off += 2; continue; }
    if (marker === 0xda) break; // start of scan — stop looking
    const len = bytes.getUint16(off + 2);
    if (marker === 0xe1) {
      // "Exif\0\0"
      const tag = [bytes.getUint8(off + 4), bytes.getUint8(off + 5), bytes.getUint8(off + 6), bytes.getUint8(off + 7)];
      if (tag[0] === 0x45 && tag[1] === 0x78 && tag[2] === 0x69 && tag[3] === 0x66) {
        return { start: off + 10, length: len - 8 };
      }
    }
    off += 2 + len;
  }
  return null;
}

/** Parse the Exif block into a plain object of readable fields. */
export function readExif(arrayBuffer) {
  const bytes = new DataView(arrayBuffer);
  const block = findExifBlock(bytes);
  if (!block) return { found: false, fields: [], gps: null };

  const base = block.start;
  if (base + 8 > bytes.byteLength) return { found: false, fields: [], gps: null };

  const order = bytes.getUint16(base);
  const littleEndian = order === 0x4949; // 'II' little, 'MM' big
  if (!littleEndian && order !== 0x4d4d) return { found: false, fields: [], gps: null };

  const ifd0 = bytes.getUint32(base + 4, littleEndian);
  const fields = [];
  let gps = null;

  const readIfd = (ifdOffset, into, depth = 0) => {
    if (depth > 3) return;
    const abs = base + ifdOffset;
    if (abs + 2 > bytes.byteLength) return;
    const count = bytes.getUint16(abs, littleEndian);
    for (let i = 0; i < count; i++) {
      const entry = abs + 2 + i * 12;
      if (entry + 12 > bytes.byteLength) break;
      const tag = bytes.getUint16(entry, littleEndian);
      const raw = readValue(bytes, entry, littleEndian, bytes, base);
      const val = formatTag(tag, raw);
      if (val) into.push({ tag, name: TAGS[tag] || `Tag 0x${tag.toString(16)}`, value: val });

      // Follow the Exif sub-IFD, and pick up GPS.
      if (tag === 0x8769) { // ExifIFD pointer
        const sub = bytes.getUint32(entry + 8, littleEndian);
        if (sub) { const subFields = []; readIfd(sub, subFields, depth + 1); into.push(...subFields); }
      }
      if (tag === 0x8825) { // GPS IFD pointer
        const gpsOff = bytes.getUint32(entry + 8, littleEndian);
        gps = readGps(bytes, base + gpsOff, littleEndian, base);
      }
    }
  };

  readIfd(ifd0, fields);

  const seen = new Set();
  const unique = fields.filter(f => {
    // Hide unnamed tags. Showing "Tag 0x213 = 2" to a normal visitor is noise;
    // if we have no human name for it, it is not useful to them.
    if (!TAGS[f.tag]) return false;
    // Internal pointers are structure, not content.
    if (f.tag === 0x8769 || f.tag === 0x8825) return false;
    const k = f.name + '|' + f.value;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return { found: unique.length > 0, fields: unique, gps, littleEndian };
}

function readGps(bytes, abs, le, base) {
  if (abs + 2 > bytes.byteLength) return null;
  const count = bytes.getUint16(abs, le);
  const g = {};
  for (let i = 0; i < count; i++) {
    const entry = abs + 2 + i * 12;
    if (entry + 12 > bytes.byteLength) break;
    const tag = bytes.getUint16(entry, le);
    const v = readValue(bytes, entry, le, bytes, base);
    if (tag === 1) g.latRef = String(v);
    if (tag === 3) g.lonRef = String(v);
  }
  // Latitude and longitude are three rationals each; read them by hand
  // because readValue only returns the first.
  const read3 = (tag) => {
    for (let i = 0; i < count; i++) {
      const entry = abs + 2 + i * 12;
      if (bytes.getUint16(entry, le) !== tag) continue;
      const off = base + bytes.getUint32(entry + 8, le);
      if (off + 24 > bytes.byteLength) return null;
      const out = [];
      for (let j = 0; j < 3; j++) {
        const n = bytes.getUint32(off + j * 8, le);
        const d = bytes.getUint32(off + j * 8 + 4, le);
        out.push(d ? n / d : 0);
      }
      return out;
    }
    return null;
  };
  const latA = read3(2), lonA = read3(4);
  if (latA && lonA) {
    const dec = (arr, ref) => {
      let v = arr[0] + arr[1] / 60 + arr[2] / 3600;
      if (ref === 'S' || ref === 'W') v = -v;
      return v;
    };
    const lat = dec(latA, g.latRef), lon = dec(lonA, g.lonRef);
    if (isFinite(lat) && isFinite(lon) && (lat || lon)) {
      return { lat: lat.toFixed(6), lon: lon.toFixed(6), ref: `${g.latRef || ''}${g.lonRef || ''}` };
    }
  }
  return null;
}
