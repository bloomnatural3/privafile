import struct, zipfile, os

def check_png(p):
    d = open(p, 'rb').read()
    w, h = struct.unpack('>II', d[16:24])
    return "PNG %dx%d %dB" % (w, h, len(d))

def check_pdf(p):
    d = open(p, 'rb').read()
    ok = 'header ok' if d[:5] == b'%PDF-' else 'BAD'
    return "PDF %s %dB" % (ok, len(d))

def check_jpg(p):
    d = open(p, 'rb').read()
    ok = 'ok' if d[:2] == b'\xff\xd8' else 'BAD'
    return "JPG %s %dB" % (ok, len(d))

print('resize  :', check_png('/tmp/out-resize-image.png'))
print('png2jpg :', check_jpg('/tmp/out-png-to-jpg.jpg'))
print('png2pdf :', check_pdf('/tmp/out-jpg-to-pdf.pdf'))
print('rotate  :', check_pdf('/tmp/out-rotate-pdf.pdf'))
print('trim    :', check_pdf('/tmp/out-remove-pdf-pages.pdf'))
print('compress:', check_jpg('/tmp/out-compress-image.jpg'))
print('--- zip contents ---')
for z in ['/tmp/out-split-pdf.zip', '/tmp/out-pdf-to-jpg.zip']:
    with zipfile.ZipFile(z) as f:
        print(os.path.basename(z), '->', [(i.filename, i.file_size) for i in f.infolist()])
