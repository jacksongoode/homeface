"""Build the weather icon font from Phosphor's filled SVGs (fonts-src/phosphor, MIT).

The 256-unit SVG viewBox becomes the em, sitting on the baseline, so at the font's pixel size the
icon fills a size x size grid exactly as Phosphor designed it. Alloy renders it anti-aliased.

usage: iconfont.py <out.ttf>
"""

import re
import sys
from pathlib import Path

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.svgLib.path import parse_path

EM = 256
SRC = Path(__file__).resolve().parent.parent / "fonts-src" / "phosphor"
ICONS = {  # glyph -> Phosphor icon; mapping from WMO codes is in src/pkjs/index.js
    "a": "sun",
    "c": "cloud",
    "d": "cloud-rain",
    "e": "cloud-snow",
    "f": "cloud-lightning",
    "g": "cloud-fog",
}


def glyph(svg):
    pen = TTGlyphPen(None)
    flip = TransformPen(Cu2QuPen(pen, max_err=0.5, reverse_direction=True), (1, 0, 0, -1, 0, EM))
    for d in re.findall(r'\sd="([^"]+)"', svg.read_text()):
        parse_path(d, flip)
    return pen.glyph()


order = [".notdef"] + [f"u{ord(c):04X}" for c in ICONS]
glyphs = {".notdef": TTGlyphPen(None).glyph()}
glyphs.update({f"u{ord(c):04X}": glyph(SRC / f"{name}.svg") for c, name in ICONS.items()})
fb = FontBuilder(EM, isTTF=True)
fb.setupGlyphOrder(order)
fb.setupCharacterMap({ord(c): f"u{ord(c):04X}" for c in ICONS})
fb.setupGlyf(glyphs)
lsb = lambda g: min((x for x, _ in g.coordinates), default=0) if g.numberOfContours else 0
fb.setupHorizontalMetrics({n: (EM, lsb(glyphs[n])) for n in order})
fb.setupHorizontalHeader(ascent=EM, descent=0)
fb.setupNameTable({"familyName": "PhosphorWeather", "styleName": "Regular"})
fb.setupOS2(sTypoAscender=EM, sTypoDescender=0, usWinAscent=EM, usWinDescent=0)
fb.setupPost()
fb.save(sys.argv[1])
