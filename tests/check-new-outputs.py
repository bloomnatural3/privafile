import struct, zipfile, os

def png_info(p):
    d = open(p, 'rb').read()
    ok = d[:8] == b'\x89PNG\r\n\x1a\n'
    w, h = struct.unpack('>II', d[16:24])
    ct = d[25]
    return "PNG %s %dx%d colourtype=%d %dB" % ('ok' if ok else 'BAD', w, h, ct, len(d))

def jpg_info(p):
    d = open(p, 'rb').read()
    return "JPG %s %dB" % ('ok' if d[:2] == b'\xff\xd8' and d[-2:] == b'\xff\xd9' else 'BAD', len(d))

def ico_info(p):
    d = open(p, 'rb').read()
    res, typ, count = struct.unpack('<HHH', d[:6])
    sizes = []
    for i in range(count):
        off = 6 + i * 16
        w = d[off] or 256
        h = d[off + 1] or 256
        bpp = struct.unpack('<H', d[off + 6:off + 8])[0]
        ln = struct.unpack('<I', d[off + 8:off + 12])[0]
        # Each frame should start with a PNG signature.
        dataoff = struct.unpack('<I', d[off + 12:off + 16])[0]
        ispng = d[dataoff:dataoff + 8] == b'\x89PNG\r\n\x1a\n'
        sizes.append("%dx%d/%dbpp/%dB/png=%s" % (w, h, bpp, ln, ispng))
    return "ICO type=%d count=%d %s" % (typ, count, ' | '.join(sizes))

print('jpg->png     :', png_info('/tmp/new-jpg-to-png.png'))
print('webp->png    :', png_info('/tmp/new-webp-to-png.png'))
print('webp->jpg    :', jpg_info('/tmp/new-webp-to-jpg.jpg'))
print('rotate-image :', png_info('/tmp/new-rotate-image.png'))
print('svg->png     :', png_info('/tmp/new-svg-to-png.png'))
print('compress200  :', jpg_info('/tmp/new-compress-to-target-size.jpg'))
print('crop         :', png_info('/tmp/new-crop-image.png'))
print('png->ico     :', ico_info('/tmp/new-png-to-ico.ico'))
print()
with zipfile.ZipFile('/tmp/new-favicon-generator.zip') as z:
    print('favicon zip  :', [i.filename for i in z.infolist()])
print()
b64 = open('/tmp/new-image-to-base64.txt').read()
print('base64       : starts %s | len %d | prefix ok %s' %
      (b64[:30], len(b64), b64.startswith('data:image/png;base64,')))
