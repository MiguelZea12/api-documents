#!/usr/bin/env bash
# Producción: sin ventana en el monitor del usuario, pero navegador "con GUI"
# en pantalla virtual (reCAPTCHA del SRI no funciona con HEADLESS=true).
#
# Requiere: xvfb-run (sudo apt install xvfb)
#
# Uso:
#   ./bin/recibidos-servidor.sh --anio=2026 --mes-desde=9 --mes-hasta=11

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v xvfb-run >/dev/null 2>&1; then
  echo "[ERROR] Instala Xvfb: sudo apt install xvfb" >&2
  exit 1
fi

export HEADLESS=false
exec xvfb-run -a --server-args='-screen 0 1280x800x24' php bin/recibidos.php "$@"
