#!/usr/bin/env bash
# Yerel canlı provası: gerçek veriye dokunmadan, canlıdaki gibi derlenmiş uygulamayı
# ayrı bir veritabanı ve portta çalıştırır.
#   npm run prova:hazirla   prova veritabanını kurar/günceller ve demo verisini (yeniden) yükler
#   npm run prova           üretim derlemesi yapar ve http://localhost:3002 adresinde başlatır
#   npm run prova:kontrol   çalışan provada sayfaları ve yetkileri kontrol eder
set -euo pipefail
cd "$(dirname "$0")/.."

set -a
# shellcheck disable=SC1091
. ./.env
set +a

# Gerçek veritabanı adresinden prova veritabanı adresini türet (yalnızca veritabanı adı değişir)
PROVA_DATABASE_URL="${PROVA_DATABASE_URL:-$(echo "$DATABASE_URL" | sed -E 's#/[^/?]+(\?|$)#/masatenisi_prova\1#')}"
case "$PROVA_DATABASE_URL" in
  *prova*) ;;
  *) echo "Güvenlik: prova veritabanı adresi 'prova' içermiyor: $PROVA_DATABASE_URL" >&2; exit 1 ;;
esac
export PROVA_PORT="${PROVA_PORT:-3002}"
export PROVA_URL="http://localhost:$PROVA_PORT"

case "${1:-}" in
  hazirla)
    # Tablolar migration'larla kurulur (veri silmez); demo betiği yalnızca prova
    # veritabanındaki veriyi temizleyip yeniden yükler.
    echo "Prova veritabanı hazırlanıyor (gerçek veriye dokunulmaz)..."
    DATABASE_URL="$PROVA_DATABASE_URL" npx prisma migrate deploy
    DATABASE_URL="$PROVA_DATABASE_URL" npx tsx prisma/demo.ts
    ;;
  baslat)
    echo "Üretim derlemesi (.next-prova)..."
    NEXT_DIST_DIR=.next-prova npx next build
    echo "Prova başlıyor: $PROVA_URL"
    # Prova kendi şifresi ve imza anahtarıyla çalışır: arkadaşlarla paylaşılabilir,
    # provadaki oturumlar gerçek uygulamada geçersizdir.
    NODE_ENV=production COOKIE_SECURE=false NEXT_DIST_DIR=.next-prova DATABASE_URL="$PROVA_DATABASE_URL" \
      ADMIN_PASSWORD="${PROVA_ADMIN_PASSWORD:-$ADMIN_PASSWORD}" AUTH_SECRET="${PROVA_AUTH_SECRET:-$AUTH_SECRET}" \
      npx next start -p "$PROVA_PORT"
    ;;
  kontrol)
    DATABASE_URL="$PROVA_DATABASE_URL" AUTH_SECRET="${PROVA_AUTH_SECRET:-$AUTH_SECRET}" npx tsx scripts/prova-kontrol.ts
    ;;
  *)
    echo "Kullanım: $0 hazirla|baslat|kontrol" >&2
    exit 1
    ;;
esac
