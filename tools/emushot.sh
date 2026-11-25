#!/bin/bash
# usage: emushot.sh <pbw> <out.png> [wait]  -- fresh emulator, install, screenshot
set -e
pebble kill >/dev/null 2>&1 || true
pebble wipe >/dev/null 2>&1 || true
sleep 1
timeout 150 pebble install --emulator emery "$1" 2>&1 | grep -iE "succe|fail|error"
sleep "${3:-6}"
pebble screenshot --emulator emery "$2" 2>&1 | grep -iE "saved|error"
