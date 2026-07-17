#!/usr/bin/env bash
set -euo pipefail

SRC="public/icon.png"
OUT="public"

if [ ! -f "$SRC" ]; then
  echo "Error: $SRC not found"
  exit 1
fi

echo "Generating icons from $SRC ..."

convert "$SRC" -resize 192x192 "$OUT/icon-192.png"
convert "$SRC" -resize 384x384 "$OUT/icon-384.png"
convert "$SRC" -resize 48x48   "$OUT/icon-48.png"
convert "$SRC" -resize 72x72   "$OUT/icon-72.png"
convert "$SRC" -resize 96x96   "$OUT/icon-96.png"
convert "$SRC" -resize 128x128 "$OUT/icon-128.png"
convert "$SRC" -resize 144x144 "$OUT/icon-144.png"
convert "$SRC" -resize 152x152 "$OUT/icon-152.png"
convert "$SRC" -resize 32x32   "$OUT/favicon.png"

echo "Done"
ls -lh "$OUT"/icon-*.png "$OUT/favicon.png"
