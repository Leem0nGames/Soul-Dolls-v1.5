#!/usr/bin/env python3
"""Bakes the modern (Kenney Roguelike pack, CC0) overworld billboards.

Reads the vendored sheet `tools/modern-source/RoguelikeSheet_misa.png`
(16x16 tiles, 1px spacing) and writes the prop sprites the overworld
renderer spawns as billboards (THREE.Sprite) into
`public/assets/props/`.

Run:  python3 tools/bake-modern-props.py
"""

import os
import struct
import sys
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SHEET = os.path.join(HERE, 'modern-source', 'RoguelikeSheet_misa.png')
OUT = os.path.join(ROOT, 'public', 'assets', 'props')

PITCH = 17  # 16px tile + 1px margin
TS = 16


# ---------------------------------------------------------------------------
# Minimal PNG codec (the repo has no third party image tooling available)
# ---------------------------------------------------------------------------

def load_png(path):
    data = open(path, 'rb').read()
    assert data[:8] == b'\x89PNG\r\n\x1a\n', 'not a png'
    pos = 8
    idat = b''
    w = h = bd = ct = None
    while pos < len(data):
        ln = struct.unpack('>I', data[pos:pos + 4])[0]
        typ = data[pos + 4:pos + 8]
        chunk = data[pos + 8:pos + 8 + ln]
        if typ == b'IHDR':
            w, h, bd, ct, _, _, inter = struct.unpack('>IIBBBBB', chunk)
            assert bd == 8 and inter == 0
        elif typ == b'IDAT':
            idat += chunk
        elif typ == b'IEND':
            break
        pos += 12 + ln
    assert ct == 6, 'expected RGBA sheet'
    raw = zlib.decompress(idat)
    stride = w * 4
    out = bytearray(w * h * 4)
    prev = bytearray(stride)
    p = 0
    for y in range(h):
        f = raw[p]
        p += 1
        line = bytearray(raw[p:p + stride])
        p += stride
        if f == 1:
            for i in range(4, stride):
                line[i] = (line[i] + line[i - 4]) & 255
        elif f == 2:
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 255
        elif f == 3:
            for i in range(stride):
                a = line[i - 4] if i >= 4 else 0
                line[i] = (line[i] + ((a + prev[i]) >> 1)) & 255
        elif f == 4:
            for i in range(stride):
                a = line[i - 4] if i >= 4 else 0
                b = prev[i]
                c = prev[i - 4] if i >= 4 else 0
                pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 255
        prev = line
        out[y * stride:(y + 1) * stride] = line
    return w, h, out


def save_png(path, w, h, pixels):
    def chunk(typ, payload):
        c = struct.pack('>I', len(payload)) + typ + payload
        return c + struct.pack('>I', zlib.crc32(typ + payload) & 0xffffffff)

    ihdr = struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)
    raw = bytearray()
    stride = w * 4
    for y in range(h):
        raw.append(0)
        raw += pixels[y * stride:(y + 1) * stride]
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) \
        + chunk(b'IDAT', zlib.compress(bytes(raw), 9)) + chunk(b'IEND', b'')
    open(path, 'wb').write(png)


# ---------------------------------------------------------------------------
# Extract the sprites (coordinates are columns/rows of the vendored sheet)
# ---------------------------------------------------------------------------

def crop(sheet_w, sheet_px, col, row, tiles_w=1, tiles_h=1):
    w = tiles_w * TS
    h = tiles_h * TS
    out = bytearray(w * h * 4)
    for y in range(h):
        for x in range(w):
            sx = col * PITCH + x
            sy = row * PITCH + y
            i = sy * sheet_w + sx
            out[(y * w + x) * 4:(y * w + x) * 4 + 4] = sheet_px[i * 4:i * 4 + 4]
    return out


# Billboards spawned by OverworldProps. Values are (col, row, tilesW, tilesH).
PROPS = {
    'tree-tall.png': (15, 10, 1, 2),   # tall round tree, canopy + trunk
    'tree-short.png': (15, 9, 1, 1),   # small round tree
    'bush.png': (25, 9, 1, 1),         # plain green bush
    'rock.png': (50, 22, 1, 1),        # mossy boulder
    'flower-a.png': (29, 9, 1, 1),     # orange flower
    'flower-b.png': (28, 9, 1, 1),     # teal flower
    'grass-tuft.png': (22, 10, 1, 1),  # little sprout (spirit grass dots)
    'sign.png': (29, 10, 1, 1),        # chalkboard signpost
}


def main():
    if not os.path.exists(SHEET):
        print('source sheet missing:', SHEET)
        return 1
    sheet_w, _, sheet_px = load_png(SHEET)
    os.makedirs(OUT, exist_ok=True)
    for name, (c, r, tw, th) in PROPS.items():
        save_png(
            os.path.join(OUT, name),
            tw * TS,
            th * TS,
            crop(sheet_w, sheet_px, c, r, tw, th),
        )
        print('baked', name, f'({tw * TS}x{th * TS})')
    with open(os.path.join(OUT, 'LICENSE.txt'), 'w') as license_file:
        license_file.write(
            'Modern overworld props\n'
            '======================\n'
            'Extracted from Kenney - Roguelike pack (www.kenney.nl).\n'
            'License: Creative Commons Zero (CC0) - http://creativecommons.org/publicdomain/zero/1.0/\n'
            'Credit "Kenney" is appreciated but not required.\n'
            'Source: tools/modern-source/RoguelikeSheet_misa.png\n'
            'Extraction: tools/bake-modern-props.py\n'
        )
    return 0


if __name__ == '__main__':
    sys.exit(main())
