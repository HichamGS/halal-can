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

# ---- Stage 2: runtime (nginx serving static + proxy) -----------------------
FROM nginx:1.27-alpine AS runtime

# Production nginx config (SPA fallback + /api, /admin proxy to Django).
COPY --from=build /app/dist /usr/share/nginx/html
# Config file expected to be mounted/baked by compose or infra build context.
# If not present, the default nginx.conf remains (compose mounts it explicitly).
COPY --from=build /app/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
