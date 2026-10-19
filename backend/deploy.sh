#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Deploy CANÓNICO del backend BAIP (Apps Script) — Codigo.gs + Panel.gs + PanelUI.html
# USAR SIEMPRE ESTE SCRIPT. No pegar el código a mano en el editor de script.google.com.
#
# Por qué existe (auditoría 2026-10-19): antes no había .clasp.json ni pipeline — el único
# camino era copiar y pegar el contenido de cada archivo en el editor web. Eso es exactamente
# el tipo de paso manual, no versionado y propenso a error (pegar la versión vieja sin querer,
# olvidar un archivo, pegar en el proyecto equivocado) que ya causó el incidente de dca-website
# del 2026-09-02 por otra vía. Este script cierra la misma brecha aquí: empuja el código
# EXACTO de este repo y actualiza la implementación EXISTENTE (preserva la URL /exec
# incrustada en los 3 HTML — nunca "Nueva implementación", que generaría una URL nueva).
#
# Requisito de una sola vez por máquina: `clasp login` (abre el navegador, inicia sesión con
# la cuenta de Google que administra el Apps Script). No es automatizable sin navegador
# — si clasp falla con `invalid_rapt` o pide reautenticación, hay que repetir `clasp login`.
#
# Uso:
#   ./deploy.sh check    → solo valida (no publica): auth, scriptId, versión local vs en vivo (default)
#   ./deploy.sh push     → clasp push (actualiza el proyecto, NO la implementación /exec en vivo)
#   ./deploy.sh deploy   → push + actualiza la implementación existente + verifica versión en vivo
#
# ⚠ El default sin argumentos es 'check' (solo lectura) — mismo criterio que el deploy.sh del
# sitio (Regla 9: nunca publicar por una invocación sin argumentos, typo, alias o wrapper).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

DEPLOYMENT_ID_FILE=".deployment-id"
ENDPOINT="https://script.google.com/macros/s/AKfycbyQZPoW4T1KbLZi2eBJh9vyt0tWzeCiDFITXCemu6WyOTkehRBLDPkszJ9FkGGFI_HD-A/exec"

say(){ printf '%s\n' "$*"; }

version_local() {
  grep -o "VERSION_MOTOR = '[^']*'" Codigo.gs | sed "s/.*'\(.*\)'/\1/"
}

version_en_vivo() {
  curl -s --max-time 15 "$ENDPOINT" | grep -oE '"version"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*"\([^"]*\)"$/\1/' || true
}

guard_clasp() {
  if [[ ! -f ".clasp.json" ]]; then
    say "✋ ABORTADO: falta backend/.clasp.json (scriptId del proyecto). Ver README-despliegue.md."
    exit 1
  fi
  if ! clasp status >/dev/null 2>&1; then
    say "✋ ABORTADO: clasp no puede leer el proyecto — probablemente falta sesión."
    say "   Corre: clasp login   (abre el navegador; inicia sesión con la cuenta de Google de DCA)"
    exit 1
  fi
}

guard_deployment_id() {
  if [[ ! -f "$DEPLOYMENT_ID_FILE" ]]; then
    say "✋ ABORTADO: falta $DEPLOYMENT_ID_FILE (el deploymentId de la implementación /exec en vivo)."
    say "   Corre 'clasp deployments', identifica la implementación activa (la que coincide con"
    say "   la URL /exec de los HTML) y guarda SOLO su ID en este archivo:"
    say "   echo -n '<deploymentId>' > $DEPLOYMENT_ID_FILE"
    exit 1
  fi
}

target="${1:-check}"
case "$target" in
  check)
    guard_clasp
    say "  ✓ clasp autenticado y .clasp.json presente."
    local_v="$(version_local || echo '?')"
    live_v="$(version_en_vivo || echo '?')"
    say "→ VERSION_MOTOR local:  $local_v"
    say "→ version respondida por el endpoint en vivo: ${live_v:-<sin respuesta>}"
    if [[ "$local_v" != "$live_v" ]]; then
      say "  ⚠ DESAJUSTADAS — el repo tiene cambios sin desplegar. Corre: ./deploy.sh deploy"
    else
      say "  ✓ Coinciden — el backend en vivo refleja este repo."
    fi
    ;;
  push)
    guard_clasp
    say "→ clasp push (actualiza el proyecto; NO toca la implementación /exec en vivo)..."
    clasp push -f
    say "  ✓ Push hecho. La implementación /exec sigue en la versión anterior hasta 'deploy'."
    ;;
  deploy)
    guard_clasp
    guard_deployment_id
    dep_id="$(cat "$DEPLOYMENT_ID_FILE")"
    say "→ clasp push..."
    clasp push -f
    say "→ Actualizando implementación existente ($dep_id) — la URL /exec NO cambia..."
    clasp deploy -i "$dep_id" -d "Deploy $(date +%Y-%m-%d) vía deploy.sh"
    say "→ Verificando versión en vivo (puede tardar unos segundos en propagar)..."
    sleep 5
    live_v="$(version_en_vivo || echo '?')"
    local_v="$(version_local || echo '?')"
    say "  local=$local_v  en vivo=$live_v"
    [[ "$local_v" == "$live_v" ]] && say "  ✓ Backend en vivo actualizado." || say "  ⚠ Aún no coincide — reintenta el check en unos segundos (propagación)."
    ;;
  *) say "Uso: ./deploy.sh [check|push|deploy]"; exit 2 ;;
esac
say "✅ Listo."
