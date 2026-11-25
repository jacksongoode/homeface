"""Build a pixel-exact TTF from an ASCII glyph file (fonts-src/*.txt).

Each design pixel is a 100-unit square and unitsPerEm = 100 * size, so at the
Pebble resource size (ppem = size) every square lands on exactly one screen
pixel and the rasterizer has nothing to round.

usage: pixfont.py <src.txt> <out.ttf> [--check]
"""

import sys

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

U = 100


def parse(path):
    meta, glyphs, cur = {}, {}, None
    for raw in open(path):
        line = raw.split("  #")[0].rstrip("\n").rstrip()
        if not line or line.startswith("#") and cur is None:
            if not line and cur is not None:
                cur = None
            continue
        if cur is None:
            key, _, val = line.partition(" ")
            if key == "char":
                cur = glyphs.setdefault(val, [])
            else:
                meta[key] = int(val)
        else:
            cur.append(line)
    return meta, glyphs


def outline(rows, left):
    pen = TTGlyphPen(None)
    n = len(rows)
    for r, row in enumerate(rows):
        y0, x = (n - 1 - r) * U, 0
        while x < len(row):
            if row[x] != "#":
                x += 1
                continue
            s = x
            while x < len(row) and row[x] == "#":
                x += 1
            x0, x1 = (left + s) * U, (left + x) * U
            # clockwise (TrueType outer contour)
            pen.moveTo((x0, y0))
            pen.lineTo((x0, y0 + U))
            pen.lineTo((x1, y0 + U))
            pen.lineTo((x1, y0))
            pen.closePath()
    return pen.glyph()


def build(src, out):
    meta, glyphs = parse(src)
    size, adv, left = meta["size"], meta["advance"] * U, meta["left"]
    order = [".notdef", "space"]
    cmap, glyf, hmtx = {32: "space"}, {}, {}
    glyf[".notdef"] = glyf["space"] = TTGlyphPen(None).glyph()
    hmtx[".notdef"] = hmtx["space"] = (adv, 0)
    for ch, rows in glyphs.items():
        name = f"u{ord(ch):04X}"
        order.append(name)
        cmap[ord(ch)] = name
        glyf[name] = outline(rows, left)
        xs = [i for row in rows for i, c in enumerate(row) if c == "#"]
        hmtx[name] = (adv, (left + min(xs)) * U if xs else 0)
    fb = FontBuilder(size * U, isTTF=True)
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(glyf)
    fb.setupHorizontalMetrics(hmtx)
    fb.setupHorizontalHeader(ascent=size * U, descent=0)
    fb.setupNameTable(
        {
            "familyName": "Pix" + src.rsplit("/", 1)[-1].split(".")[0],
            "styleName": "Regular",
        }
    )
    fb.setupOS2(
        sTypoAscender=size * U, sTypoDescender=0, usWinAscent=size * U, usWinDescent=0
    )
    fb.setupPost()
    fb.save(out)
    return size, glyphs


def check(out, size, glyphs):
    """Rasterize like the SDK's fontgen (both modes) and compare to the source."""
    import freetype as ft

    face = ft.Face(out)
    face.set_pixel_sizes(0, size)
    modes = {
        "mono": ft.FT_LOAD_RENDER | ft.FT_LOAD_MONOCHROME | ft.FT_LOAD_TARGET_MONO,
        "legacy": ft.FT_LOAD_RENDER,
    }
    bad = 0
    for mode, flags in modes.items():
        for ch, rows in glyphs.items():
            face.load_char(ch, flags)
            b = face.glyph.bitmap
            got = set()
            for r in range(b.rows):
                for c in range(b.width):
                    if b.pixel_mode == 1:
                        on = (b.buffer[r * b.pitch + c // 8] >> (7 - c % 8)) & 1
                    else:
                        on = b.buffer[r * b.pitch + c] > 127
                    if on:
                        got.add(
                            (
                                face.glyph.bitmap_left + c,
                                len(rows) - face.glyph.bitmap_top + r,
                            )
                        )
            want = {
                (i, r)
                for r, row in enumerate(rows)
                for i, c in enumerate(row)
                if c == "#"
            }
            # compare shapes; horizontal origin is the font's left bearing
            if want:
                dx = min(x for x, _ in got) - min(x for x, _ in want) if got else 0
                want = {(x + dx, y) for x, y in want}
            if got != want:
                bad += 1
                print(f"MISMATCH {mode} {ch!r}")
    print(f"{out}: {len(glyphs)} glyphs, {bad} mismatches")
    return bad == 0


if __name__ == "__main__":
    size, glyphs = build(sys.argv[1], sys.argv[2])
    if "--check" in sys.argv:
        sys.exit(0 if check(sys.argv[2], size, glyphs) else 1)
