#!/usr/bin/env python3
"""Bakes the modern (Kenney Roguelike pack, CC0) overworld tiles.

Downloads nothing: it reads the vendored sheet
`tools/modern-source/RoguelikeSheet_misa.png` (16x16 tiles, 1px spacing) and
writes the individual cut tiles the on-world baking pipeline uses into
`public/tilesets/overworld/modern/`.

Run:  python3 tools/bake-modern-tiles.py
"""

import os
import struct
import sys
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SHEET = os.path.join(HERE, 'modern-source', 'RoguelikeSheet_misa.png')
OUT = os.path.join(ROOT, 'public', 'tilesets', 'overworld', 'modern')

PITCH = 17  # 16px tile + 1px margin


# ---------------------------------------------------------------------------
# Minimal PNG codec (no third party dependencies available in this repo)
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
            assert bd == 8 and inter == 0, f'unsupported png bd={bd} inter={inter}'
        elif typ == b'IDAT':
            idat += chunk
        elif typ == b'IEND':
            break
        pos += 12 + ln
    assert ct in (2, 6), f'unsupported color type {ct} (expected RGB/RGBA)'
    ch = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[ct]
    raw = zlib.decompress(idat)
    stride = w * ch
    out = bytearray(w * h * ch)
    prev = bytearray(stride)
    p = 0
    for y in range(h):
        f = raw[p]
        p += 1
        line = bytearray(raw[p:p + stride])
        p += stride
        if f == 1:
            for i in range(ch, stride):
                line[i] = (line[i] + line[i - ch]) & 255
        elif f == 2:
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 255
        elif f == 3:
            for i in range(stride):
                a = line[i - ch] if i >= ch else 0
                line[i] = (line[i] + ((a + prev[i]) >> 1)) & 255
        elif f == 4:
            for i in range(stride):
                a = line[i - ch] if i >= ch else 0
                b = prev[i]
                c = prev[i - ch] if i >= ch else 0
                pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 255
        prev = line
        out[y * stride:(y + 1) * stride] = line
    if ct == 2:
        rgba = bytearray(w * h * 4)
        for i in range(w * h):
            rgba[i * 4:i * 4 + 4] = out[i * 3:i * 3 + 3] + b'\xff'
        return w, h, rgba
    return w, h, out


def save_png(path, tr, wr, pixels):
    """pixels: bytearray RGBA of size tr*wr*4."""
    def chunk(typ, payload):
        c = struct.pack('>I', len(payload)) + typ + payload
        return c + struct.pack('>I', zlib.crc32(typ + payload) & 0xffffffff)

    ihdr = struct.pack('>IIBBBBB', tr, wr, 8, 6, 0, 0, 0)
    raw = bytearray()
    stride = tr * 4
    for y in range(wr):
        raw.append(0)
        raw += pixels[y * stride:(y + 1) * stride]
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) \
        + chunk(b'IDAT', zlib.compress(bytes(raw), 9)) + chunk(b'IEND', b'')
    open(path, 'wb').write(png)


# ---------------------------------------------------------------------------
# Extraction
# ---------------------------------------------------------------------------

def is_grass_green(r, g, b):
    """The bright grass hue the sheet paints behind the baked-in props."""
    return g > r + 30 and g > b + 40


def cut(w, h, px, col, row):
    x0, y0 = col * PITCH, row * PITCH
    out = bytearray(16 * 16 * 4)
    for y in range(16):
        for x in range(16):
            i = (y0 + y) * w + x0 + x
            out[(y * 16 + x) * 4:(y * 16 + x) * 4 + 4] = px[i * 4:i * 4 + 4]
    return out


def key_grass(tile_px):
    """Turn the bright grass background of a baked-in sprite transparent."""
    out = bytearray(tile_px)
    for p in range(16 * 16):
        r, g, b = out[p * 4], out[p * 4 + 1], out[p * 4 + 2]
        if is_grass_green(r, g, b):
            out[p * 4 + 3] = 0
    return out


def key_flower(tile_px, white):
    """Keep only the flower petals (not the grass background)."""
    out = bytearray(tile_px)
    for p in range(16 * 16):
        r, g, b, a = out[p * 4:p * 4 + 4]
        if a == 0:
            continue
        if not white:
            # orange/red petals + yellow core: r dominates green
            keep = r > g + 18 or (r > 200 and g > 190 and b < 140)
        else:
            # white petals (light grey/white) + yellow core; grass green fails on g >> r,b
            keep = (r > 110 and abs(r - g) < 45 and abs(g - b) < 45) \
                or (r > 180 and g > 150 and b < 120)
        if not keep:
            out[p * 4 + 3] = 0
    return out


def main():
    if not os.path.exists(SHEET):
        print('source sheet missing:', SHEET)
        return 1
    os.makedirs(OUT, exist_ok=True)
    w, h, px = load_png(SHEET)

    flat = {
        'Grass.png': (5, 0),
        'Grass-Dappled.png': (0, 15),
        'Path.png': (6, 1),
        'Sand.png': (8, 0),
    }
    for name, (c, r) in flat.items():
        save_png(os.path.join(OUT, name), 16, 16, cut(w, h, px, c, r))

    # Water 9-patch from the lake block (grass background keyed out).
    water_parts = {
        'Water-TL.png': (2, 0), 'Water-T.png': (3, 0), 'Water-TR.png': (4, 0),
        'Water-L.png': (2, 1), 'Water-C.png': (3, 1), 'Water-R.png': (4, 1),
        'Water-BL.png': (2, 2), 'Water-B.png': (3, 2), 'Water-BR.png': (4, 2),
    }
    for name, (c, r) in water_parts.items():
        t = cut(w, h, px, c, r)
        if name != 'Water-C.png':
            t = key_grass(t)
        save_png(os.path.join(OUT, name), 16, 16, t)

    # Spirit-grass tuft 9-patch (transparent background already).
    tuft_parts = {
        'TallTuft-TL.png': (2, 15), 'TallTuft-T.png': (3, 15), 'TallTuft-TR.png': (4, 15),
        'TallTuft-L.png': (2, 16), 'TallTuft-C.png': (3, 16), 'TallTuft-R.png': (4, 16),
        'TallTuft-BL.png': (2, 17), 'TallTuft-B.png': (3, 17), 'TallTuft-BR.png': (4, 17),
    }
    for name, (c, r) in tuft_parts.items():
        save_png(os.path.join(OUT, name), 16, 16, cut(w, h, px, c, r))

    # Gravel island 9-patch (orange dirt blob, transparent background already).
    island_parts = {
        'Island-TL.png': (2, 18), 'Island-T.png': (3, 18), 'Island-TR.png': (4, 18),
        'Island-L.png': (2, 19), 'Island-C.png': (3, 19), 'Island-R.png': (4, 19),
        'Island-BL.png': (2, 20), 'Island-B.png': (3, 20), 'Island-BR.png': (4, 20),
    }
    for name, (c, r) in island_parts.items():
        save_png(os.path.join(OUT, name), 16, 16, cut(w, h, px, c, r))

    # Flower overlays keyed out of the baked flower tiles.
    save_png(os.path.join(OUT, 'Flower-orange-0.png'), 16, 16, key_flower(cut(w, h, px, 0, 6), False))
    save_png(os.path.join(OUT, 'Flower-orange-1.png'), 16, 16, key_flower(cut(w, h, px, 1, 6), False))
    save_png(os.path.join(OUT, 'Flower-white-0.png'), 16, 16, key_flower(cut(w, h, px, 0, 9), True))
    save_png(os.path.join(OUT, 'Flower-white-1.png'), 16, 16, key_flower(cut(w, h, px, 1, 9), True))

    # Licence / provenance notes.
    with open(os.path.join(OUT, 'LICENSE.txt'), 'w') as f:
        f.write(
            'Modern overworld tiles\n'
            '======================\n'
            'Cut from Kenney - Roguelike pack (www.kenney.nl).\n'
            'License: Creative Commons Zero (CC0) - http://creativecommons.org/publicdomain/zero/1.0/\n'
            'Credit "Kenney" is appreciated but not required.\n'
            'Individual tiles were extracted from the original spritesheet\n'
            '(16x16, 1px spacing) with tools/bake-modern-tiles.py.\n'
        )

    count = len(flat) + len(water_parts) + len(tuft_parts) + len(island_parts) + 4
    print('baked', count, 'tiles into', OUT)
    return 0


if __name__ == '__main__':
    sys.exit(main())
