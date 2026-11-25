#!/bin/bash
# bbox.sh img WxH+X+Y [bg]  -> absolute ink bbox "x0-x1 y0-y1 (wxh)" within region
img=$1; g=$2; bg=${3:-black}
IFS='x+' read -r W H X Y <<<"$g"
magick "$img" -alpha off -crop "$g" +repage -bordercolor "$bg" -border 1 -fuzz 0 -format "%@" info: |
  { IFS='x+' read -r w h x y; [ "$w" -gt "$((W+1))" ] 2>/dev/null && { echo empty; exit; }
    echo "x $((X+x-1))-$((X+x-2+w)) y $((Y+y-1))-$((Y+y-2+h)) (${w}x${h})"; }
