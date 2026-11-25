# Homeface

Pebble Time 2 (emery) watchface written in Alloy (JavaScript on the watch, Poco renderer): date,
weather, a large clock and a second time zone. Layout and
colours follow [Homezone](https://apps.rebble.io/en_US/application/6a32271ee24af400096e07f0) by
Ciaran Flanagan, redrawn so every element is pixel-exact on the 200x228 screen.

- Small text uses hand-drawn pixel fonts (`fonts-src/*.txt`) instead of Space Mono rasterized at
  13-18px, so every stroke is 1px and every glyph sits on a fixed pitch. The light theme uses a
  bold variant (2px stems), since thin dark strokes on white read too faint.
- Clock, temperature and values use anti-aliased Space Grotesk SemiBold (OFL,
  `src/embeddedjs/assets/OFL.txt`) and are placed by their visible ink using
  `src/embeddedjs/metrics.js`, so the clock is always centred and right-aligned values end exactly
  on the margin.
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
| `uv run --with fonttools --with freetype-py python tools/pixfont.py fonts-src/mono10.txt src/embeddedjs/assets/Pix-mono10.ttf --check` | Builds a pixel font (`--bold` for the light-theme variant) and checks it rasterizes exactly as drawn |
| `uv run --with fonttools python tools/iconfont.py src/embeddedjs/assets/PhosphorWeather.ttf` | Builds the weather icon font from the [Phosphor](https://phosphoricons.com) SVGs in `fonts-src/phosphor` (MIT) |
| `pebble build && uv run --with pillow python tools/metrics.py && pebble build` | Regenerates `src/embeddedjs/metrics.js` from the build's font atlases after a font or character-set change |
| `tools/diff.sh [ref.png]` | Builds with fixed sample data (`src/embeddedjs/demo.js`), screenshots the emulator and prints each element's ink box against `reference/golden-demo.png` |
