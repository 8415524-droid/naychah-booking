#!/usr/bin/env bash
# התקנת נייחא על שרת Ubuntu נקי. הרצה כ-root:
#   curl -fsSL https://raw.githubusercontent.com/8415524-droid/naychah-booking/main/scripts/install.sh | bash
# (אם הריפו פרטי: קודם git clone, ואז bash scripts/install.sh)
set -euo pipefail

REPO="https://github.com/8415524-droid/naychah-booking.git"
DIR="/opt/naychah-booking"

echo "== 1/5 התקנת Docker =="
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi

echo "== 2/5 הורדת הקוד =="
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" pull --ff-only
elif [ -f "./docker-compose.yml" ] && [ -d "./.git" ]; then
  DIR="$(pwd)"
else
  git clone "$REPO" "$DIR"
fi
cd "$DIR"

echo "== 3/5 הגדרות =="
if [ -f .env ]; then
  echo "קובץ .env כבר קיים, משאיר אותו כמו שהוא."
else
  IP="$(curl -fsS https://api.ipify.org || true)"
  DEFAULT_DOMAIN=""
  [ -n "$IP" ] && DEFAULT_DOMAIN="${IP//./-}.sslip.io"
  read -r -p "דומיין לאתר [$DEFAULT_DOMAIN]: " DOMAIN </dev/tty
  DOMAIN="${DOMAIN:-$DEFAULT_DOMAIN}"
  read -r -s -p "המפתח הסודי של Supabase (secret key), הדבק ולחץ Enter: " SERVICE_KEY </dev/tty
  echo
  cp .env.example .env
  sed -i "s|^SUPABASE_SERVICE_ROLE_KEY=.*|SUPABASE_SERVICE_ROLE_KEY=${SERVICE_KEY}|" .env
  sed -i "s|^PBX_SECRET=.*|PBX_SECRET=$(openssl rand -hex 24)|" .env
  sed -i "s|^TZINTUK_SECRET=.*|TZINTUK_SECRET=$(openssl rand -hex 24)|" .env
  sed -i "s|^DOMAIN=.*|DOMAIN=${DOMAIN}|" .env
  chmod 600 .env
fi

echo "== 4/5 חומת אש =="
if command -v ufw >/dev/null 2>&1; then
  ufw allow 22/tcp >/dev/null && ufw allow 80/tcp >/dev/null && ufw allow 443/tcp >/dev/null
  ufw --force enable >/dev/null
fi

echo "== 5/5 בנייה והפעלה (כמה דקות) =="
docker compose up -d --build

set -a; . ./.env; set +a
echo
echo "הושלם. האתר: https://${DOMAIN}"
echo "כתובת קו לקוחות בטכנוליין:      https://${DOMAIN}/api/pbx/main/${PBX_SECRET}"
echo "כתובת קו בעלי דירות בטכנוליין:  https://${DOMAIN}/api/pbx/owner/${PBX_SECRET}"
echo "כתובת IP של השרת לאישור בטכנוליין: $(curl -fsS https://api.ipify.org || echo לא זוהתה)"
