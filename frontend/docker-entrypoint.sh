#!/bin/sh
# ---------------------------------------------------------------------------
# Maghreb Connect – frontend container entrypoint
#
# Production image: nginx serving the built SPA (dist/ copied at build time).
# This script renders runtime env placeholders into the served config so the
# tile style URL etc. can be adjusted per deployment without rebuilding,
# then hands over to the original docker-entrypoint chain.
#
# Dev mode does NOT use this script: docker-compose runs `npm run dev`
# directly from the bind-mounted source for hot reload.
# ---------------------------------------------------------------------------
set -e

# Expose runtime-configurable map settings to the SPA as a small JSON file
# fetched at startup (src/services/config.ts reads /config.json and falls
# back to build-time VITE_* values). Only client-safe values here — never
# provider API keys.
CONFIG_FILE="/usr/share/nginx/html/config.json"
cat > "${CONFIG_FILE}" <<EOF
{
  "mapStyleUrl": "${VITE_MAP_STYLE_URL:-https://demotiles.maplibre.org/style.json}",
  "mapCenterLng": ${VITE_MAP_CENTER_LNG:--96.0},
  "mapCenterLat": ${VITE_MAP_CENTER_LAT:-58.0},
  "mapZoom": ${VITE_MAP_ZOOM:-3.5},
  "apiBaseUrl": "${VITE_API_BASE_URL:-/api/v1}"
}
EOF

exec "$@"
