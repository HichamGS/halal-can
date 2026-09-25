# ---------------------------------------------------------------------------
# Maghreb Connect – React frontend image
#
# Multi-stage:
#   1. node base image builds the Vite production bundle (dist/).
#   2. The dist/ output is copied into an nginx:alpine runtime that serves
#      the SPA and reverse-proxies /api/ + /admin/ to Django.
#      (nginx config lives in infra/nginx/maghreb.conf)
#
# Dev mode does NOT use this image: docker-compose runs `npm run dev`
# directly from a bind mount for hot reload (see docker-compose.yml).
# ---------------------------------------------------------------------------

# ---- Stage 1: build --------------------------------------------------------
FROM node:20-alpine AS build

WORKDIR /app

# Install dependencies first for layer caching.
COPY package.json package-lock.json* ./
RUN npm ci || npm install

# Copy source and build.
COPY . .

# VITE_* vars are baked in at build time; supply them via --build-arg or
# .env files when building the production image.
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_MAP_STYLE_URL=https://demotiles.maplibre.org/style.json
ARG VITE_MAP_CENTER_LNG=-96.0
ARG VITE_MAP_CENTER_LAT=58.0
ARG VITE_MAP_ZOOM=3.5
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_MAP_STYLE_URL=$VITE_MAP_STYLE_URL \
    VITE_MAP_CENTER_LNG=$VITE_MAP_CENTER_LNG \
    VITE_MAP_CENTER_LAT=$VITE_MAP_CENTER_LAT \
    VITE_MAP_ZOOM=$VITE_MAP_ZOOM

RUN npm run build

# ---- Stage 2: runtime (nginx serving static SPA) ----------------------------
FROM nginx:1.27-alpine AS runtime

# Built SPA bundle. API/admin reverse-proxying is handled by the edge
# nginx container (infra/nginx), NOT here — this image only serves statics.
COPY --from=build /app/dist /usr/share/nginx/html

# Runtime config renderer: writes /config.json (map style URL etc.) from env
# so tile settings can change per deployment without rebuilding. Installed as
# a docker-entrypoint.d step so nginx's stock entrypoint chain still runs
# (envsubst templates, etc.), then nginx starts via the original CMD.
COPY docker-entrypoint.sh /etc/docker-entrypoint.env.sh
RUN chmod +x /etc/docker-entrypoint.env.sh && \
    printf '#!/bin/sh\n. /etc/docker-entrypoint.env.sh\n' \
        > /docker-entrypoint.d/05-render-config.sh && \
    chmod +x /docker-entrypoint.d/05-render-config.sh

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -qO /dev/null http://localhost/ || exit 1
