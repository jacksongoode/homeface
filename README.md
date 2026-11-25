# Homeface

A Pebble Time 2 watchface showing the time, date, weather and a second time zone, written in Alloy.
Forked from [Homezone](https://apps.rebble.io/en_US/application/6a32271ee24af400096e07f0) by
Ciaran Flanagan.

## Build

```sh
pebble build
pebble install --phone <phone-ip>
```

## Fonts

The fonts in `src/embeddedjs/assets` are generated; edit the sources and rerun the tool:

- `tools/pixfont.py`: pixel fonts from `fonts-src/*.txt`.
- `tools/iconfont.py`: weather icons from `fonts-src/phosphor`.
- `tools/metrics.py`: refreshes `src/embeddedjs/metrics.js` after a font change (run between two builds).

## Credits

Space Grotesk (SIL OFL 1.1), Phosphor icons (MIT), Clay (MIT), weather from Open-Meteo.
