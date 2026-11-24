#!/bin/bash
# מערבב כל הקראת תור (public/audio/queue-speech) מעל שיר ההמתנה, עם הנמכה עדינה של המוזיקה בזמן דיבור.
# שימוש: scripts/mix-queue.sh <קובץ-שיר> [שניית-התחלה בשיר]
set -e
SONG="$1"; START="${2:-0}"
mkdir -p public/audio/queue
for f in public/audio/queue-speech/*.mp3; do
  k=$(basename "$f" .mp3)
  d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
  ffmpeg -y -loglevel error -ss "$START" -i "$SONG" -i "$f" -filter_complex \
   "[0:a]aresample=24000,pan=mono|c0=0.5*c0+0.5*c1,atrim=0:$(echo "$d + 3" | bc),volume=0.55,afade=t=in:d=0.4,afade=t=out:st=$(echo "$d + 1.5" | bc):d=1.5[m];\
    [1:a]adelay=700,asplit[v][s];\
    [m][s]sidechaincompress=threshold=0.02:ratio=8:attack=20:release=500[duck];\
    [duck][v]amix=inputs=2:duration=first:normalize=0,highpass=f=300,lowpass=f=3400,acompressor=threshold=0.1:ratio=3,loudnorm=I=-16:TP=-2,aresample=8000[o]" \
   -map "[o]" -ar 8000 -ac 1 -b:a 32k "public/audio/queue/$k.mp3"
  echo "מוכן $k"
done
