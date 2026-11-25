# Homeface

Pebble Time 2 (emery) watchface: date, weather, a large clock and a second time zone. Layout and
colours follow [Homezone](https://apps.rebble.io/en_US/application/6a32271ee24af400096e07f0) by
Ciaran Flanagan, redrawn so every element is pixel-exact on the 200x228 screen.

- Small text uses hand-drawn pixel fonts (`fonts-src/*.txt`) instead of Space Mono rasterized at
  13-18px, so every stroke is 1px and every glyph sits on a fixed pitch.
- Clock, temperature and values use Space Grotesk SemiBold (OFL, `resources/fonts/OFL.txt`) and are
  placed by their ink using `src/c/metrics.auto.h`, so the clock is always centred and right-aligned
  values end exactly on the margin.
- Layout is a 16px margin / 8px gap grid; the weather sits on the line between weekday and date, and
  the bottom row's dot, label and value share one midline.

Settings (Clay): home time zone and label, bottom bar (home time, battery, steps, heart rate,
calories), dark/light theme, accent colour, °C/°F. Weather is from Open-Meteo.

## Build

```sh
pebble build
pebble install --phone <phone-ip>    # LAN developer connection
pebble install --emulator emery
```

## Tools

| Command | Does |
| --- | --- |
| `uv run --with fonttools --with freetype-py python tools/pixfont.py fonts-src/mono10.txt resources/fonts/Pix-mono10.ttf --check` | Builds a pixel font and checks it rasterizes exactly as drawn |
| `uv run python tools/icons.py fonts-src/icons.txt` | Regenerates the icon glyph source (then build it with `pixfont.py`) |
| `uv run --with freetype-py python tools/metrics.py` | Regenerates `src/c/metrics.auto.h` after a font or character-set change |
| `tools/diff.sh [ref.png]` | Builds with `DEMO=1` (fixed sample data), screenshots the emulator and prints each element's ink box against `reference/golden-demo.png` (or `reference/orig-dark.png`, the original) |
| `tools/appmsg.py <uuid> key=value ...` | Sends an AppMessage to an app in the emulator (run with the pebble-tool Python) |
