#!/bin/bash
# מרכיב כל הקראת תור (public/audio/queue-speech) עם שיר ההמתנה: מוזיקה קצרה, ואז הקראה בלי שום מוזיקה (השיר נעצר לגמרי), ואז מוזיקה שוב.
# שימוש: scripts/mix-queue.sh <קובץ-שיר> [שניית-התחלה בשיר]
set -e
SONG="$1"; START="${2:-0}"
LEAD=1.5   # מוזיקה לפני ההקראה
TAIL=2.5   # מוזיקה אחרי ההקראה
mkdir -p public/audio/queue
for f in public/audio/queue-speech/*.mp3; do
  k=$(basename "$f" .mp3)
  ffmpeg -y -loglevel error -ss "$START" -i "$SONG" -i "$f" -filter_complex \
   "[0:a]aresample=24000,pan=mono|c0=0.5*c0+0.5*c1,volume=0.5,asplit=2[m1][m2];\
    [m1]atrim=0:$LEAD,asetpts=N/SR/TB,afade=t=in:d=0.3,afade=t=out:st=$(echo "$LEAD - 0.4" | bc):d=0.4[lead];\
    [m2]atrim=$LEAD:$(echo "$LEAD + $TAIL" | bc),asetpts=N/SR/TB,afade=t=in:d=0.5,afade=t=out:st=$(echo "$TAIL - 1.2" | bc):d=1.2[tail];\
    [1:a]aresample=24000[v];\
    [lead][v][tail]concat=n=3:v=0:a=1,highpass=f=300,lowpass=f=3400,acompressor=threshold=0.1:ratio=3,loudnorm=I=-16:TP=-2,aresample=8000[o]" \
   -map "[o]" -ar 8000 -ac 1 -b:a 32k "public/audio/queue/$k.mp3"
  echo "מוכן $k"
done
