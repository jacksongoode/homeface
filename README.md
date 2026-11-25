# Homeface

A Pebble Time 2 watchface showing the time, date, weather and a second time zone. Written in
Alloy. Inspired by [Homezone](https://apps.rebble.io/en_US/application/6a32271ee24af400096e07f0)
by Ciaran Flanagan.

## Build

```sh
pebble build
pebble install --phone <phone-ip>
```

## Tools

- `tools/pixfont.py`: builds the pixel fonts from `fonts-src/*.txt`.
- `tools/iconfont.py`: builds the weather icon font from `fonts-src/phosphor`.
- `tools/metrics.py`: updates `src/embeddedjs/metrics.js` after a font change (run between two builds).
- `tools/diff.sh`: compares an emulator screenshot against `reference/golden-demo.png`.

## Credits

Space Grotesk (SIL OFL 1.1), Phosphor icons (MIT), Clay (MIT), weather from Open-Meteo.
