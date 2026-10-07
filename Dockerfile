# DesTree — imagen de producción (F7). Multi-stage: build con toolchain (por si sharp necesita compilar), runtime slim sin toolchain.
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DATABASE_PATH=/data/destree.db
WORKDIR /app
# tar: respaldos (lib/backup.js); curl: HEALTHCHECK
RUN apt-get update && apt-get install -y --no-install-recommends tar curl && rm -rf /var/lib/apt/lists/* \
 && mkdir -p /data && chown -R node:node /data /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node server ./server
COPY --chown=node:node client ./client
COPY --chown=node:node schema ./schema
COPY --chown=node:node scripts ./scripts
USER node
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server/index.js"]
