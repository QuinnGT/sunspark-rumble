# Build the static site, then serve dist/ with nginx. Tests run in CI, not here.
FROM node:22.23.5-alpine3.24 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Public site URL (https://example.com, no trailing slash) for absolute Open Graph and canonical tags.
ARG SITE_URL
ENV SITE_URL=$SITE_URL
# A failed surface gate must fail the image build (AGENTS.md).
RUN node scripts/check-surfaces.mjs \
 && npm run build \
 && npm run build:web

FROM nginx:1.30.6-alpine3.24
# Drop the stock welcome and 50x pages so unknown paths return 404.
RUN rm -rf /usr/share/nginx/html/*
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
