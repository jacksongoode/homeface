#!/bin/bash
# ascii.sh img WxH+X+Y : '#' >200, '+' >100, '-' >40 (gray), '.' else
H=$(echo "$2" | sed 's/.*x\([0-9]*\)+.*/\1/')
magick "$1" -alpha off -crop "$2" +repage -colorspace gray -depth 8 txt:- |
 awk -F'[,: ()]+' -v H=$H 'NR>1{v=$6; row[$2]=row[$2] ((v>200)?"#":(v>100)?"+":(v>40)?"-":".")} END{for(i=0;i<H;i++)print row[i]}'
