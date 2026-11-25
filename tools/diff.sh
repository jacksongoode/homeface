#!/bin/bash
# DEMO build -> emulator screenshot -> per-element ink bbox vs reference, as numbers.
# usage: tools/diff.sh [ref.png]   (default: reference/golden-demo.png, the approved layout;
#        reference/orig-dark.png is the original Homezone at the same time and weather)
set -e
cd "$(dirname "$0")/.."
REF=${1:-reference/golden-demo.png}; OUT=build/shot.png
cp src/embeddedjs/demo.js build/demo.js.bak 2>/dev/null || { mkdir -p build; cp src/embeddedjs/demo.js build/demo.js.bak; }
trap 'cp build/demo.js.bak src/embeddedjs/demo.js' EXIT
cat > src/embeddedjs/demo.js <<'JS'
const date = new Date(2026, 10, 25, 0, 29);
const home = 8 * 60 + 29 - (date.getUTCHours() * 60 + date.getUTCMinutes());
export default { date, settings: { temp: 14, icon: "c", tzOffset: home, tzLabel: "DUBLIN" } };
JS
pebble build >/dev/null 2>&1 || { pebble build 2>&1 | grep -iE "error" ; exit 1; }
tools/emushot.sh build/homeface.pbw $OUT 4 >/dev/null
B=tools/bbox.sh
while read -r name g; do
  r=$($B "$REF" "$g"); m=$($B "$OUT" "$g")
  [ "$r" = "$m" ] && s=OK || s=DIFF
  printf "%-6s %-9s ref %-30s mine %s\n" "$s" "$name" "$r" "$m"
done <<'R'
day      70x12+0+14
date     90x14+0+33
weather  100x34+84+14
time     200x56+0+86
rule     200x3+0+178
bdot     12x14+12+194
label    90x18+28+194
value    72x22+120+192
R
echo "pixels differing: $(magick compare -metric AE "$REF" $OUT null: 2>&1)"
