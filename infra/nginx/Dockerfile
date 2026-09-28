# ---------------------------------------------------------------------------
# Maghreb Connect – Nginx edge proxy (production profile)
#
# Serves:
#   /            -> static SPA bundle from the frontend-static container
#   /api/, /admin/, /static/ -> proxied to the Django backend
#   /media/      -> served from a shared volume (if you add one later)
#
# Built as its own image so the config is baked in and versioned with the app.
# ---------------------------------------------------------------------------
FROM nginx:1.27-alpine

# Remove default site, install ours.
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/maghreb.conf

# Basic hardening + assets for TLS if certificates are mounted later.
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -qO /dev/null http://localhost/healthz || exit 1
