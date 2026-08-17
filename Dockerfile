# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1: build the React/Vite frontend into static assets.
# ---------------------------------------------------------------------------
FROM node:22-slim AS client-build
WORKDIR /app/client
COPY client/package.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2: install server dependencies. Isolated in its own stage so the
# build toolchain needed to compile the native SQLCipher module (only
# required if no prebuilt binary matches this platform/arch) never ends up
# in the final image.
# ---------------------------------------------------------------------------
FROM node:22-slim AS server-deps
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app/server
COPY server/package.json ./
RUN npm install --omit=dev

# ---------------------------------------------------------------------------
# Stage 3: the actual runtime image — one process, one port.
# ---------------------------------------------------------------------------
FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=server-deps /app/server/node_modules ./server/node_modules
COPY server/ ./server/
COPY --from=client-build /app/client/dist ./client/dist

# /data is where the encrypted SQLite file lives — mount this as a volume.
RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 3000
CMD ["node", "server/src/index.js"]
