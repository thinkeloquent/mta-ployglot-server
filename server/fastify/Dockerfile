# syntax=docker/dockerfile:1.7
# server/fastify/Dockerfile
#
# Multi-stage build for the standalone mta-fastify-server. Builds
# @ployglot/fastify-server from the bootstrap submodule, then assembles
# /app from server/fastify/ (main.mjs + config/) with the built bootstrap
# placed at /app/node_modules/fastify-server/ so `import "fastify-server"`
# resolves.
#
# Build context is the repo root so both `COPY ployglots/...` and
# `COPY server/fastify/...` resolve.
#
# Hardening (limited, not production):
#   - base image pinned by digest
#   - non-root runtime user (`node`, built into the base image)
#   - `init: true` for signal forwarding is set from compose, not here.

ARG NODE_IMAGE=node:22-slim@sha256:d415caac2f1f77b98caaf9415c5f807e14bc8d7bdea62561ea2fef4fbd08a73c

# -----------------------------------------------------------------------------
# Stage 1: builder — install bootstrap deps + compile TS
# -----------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS builder

WORKDIR /bootstrap

# Copy only the bootstrap fastify package manifest first for layer caching.
COPY ployglots/mta-ployglot-server-bootstrap/fastify_server/package.json \
     ployglots/mta-ployglot-server-bootstrap/fastify_server/package-lock.json \
     ployglots/mta-ployglot-server-bootstrap/fastify_server/tsconfig.json \
     ./

# npm registry — SSOT is `Makefile.vars NPM_REGISTRY`. The Make-driven path
# (`make docker-install` / `make ci-install` / `make build.docker`) passes the
# value through as `--build-arg NPM_REGISTRY=...`. The default below mirrors
# Makefile.vars and is only consulted when this Dockerfile is built RAW
# (direct `docker build ...` outside the Makefile). If you change one, change
# the other so the two defaults stay in lockstep.
#
# Override examples:
#   make docker-install NPM_REGISTRY=https://registry.npmjs.org
#   docker build --build-arg NPM_REGISTRY=https://registry.npmjs.org ...
#
# Integrity hashes (sha512) in the lockfile are registry-independent, so
# swapping the URL preserves determinism. Default is a no-op rewrite.
ARG NPM_REGISTRY=http://localhost:4873
RUN sed -i "s|http://localhost:4873|${NPM_REGISTRY}|g" package-lock.json

# Deterministic install; lockfile is authoritative.
RUN npm ci --no-audit --no-fund

# Source + contracts needed for build.
COPY ployglots/mta-ployglot-server-bootstrap/fastify_server/src/        ./src/
COPY ployglots/mta-ployglot-server-bootstrap/fastify_server/contracts/  ./contracts/

# Compile TypeScript → dist/
RUN npm run build

# Drop devDependencies so the runtime layer is smaller.
RUN npm prune --omit=dev

# -----------------------------------------------------------------------------
# Stage 2: runtime — minimal, non-root
# -----------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runtime

ENV NODE_ENV=production \
    PORT=3000 \
    NODE_OPTIONS=--disable-proto=delete \
    POLYGLOT_DEBUG=1

WORKDIR /app

# Standalone app: main.mjs + config/ + package.json from server/fastify/.
COPY --chown=node:node server/fastify/package.json ./package.json
COPY --chown=node:node server/fastify/main.mjs     ./main.mjs
COPY --chown=node:node server/fastify/config       ./config

# Place the built bootstrap at node_modules/fastify-server/ so
# `import "fastify-server"` resolves to its exports map. The bootstrap's
# own runtime deps (fastify, close-with-grace) live inside its nested
# node_modules and resolve via Node's normal lookup.
COPY --from=builder --chown=node:node /bootstrap/package.json   ./node_modules/fastify-server/package.json
COPY --from=builder --chown=node:node /bootstrap/dist           ./node_modules/fastify-server/dist
COPY --from=builder --chown=node:node /bootstrap/contracts      ./node_modules/fastify-server/contracts
COPY --from=builder --chown=node:node /bootstrap/node_modules   ./node_modules/fastify-server/node_modules

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://127.0.0.1:' + (process.env.PORT || 3000) + '/healthz', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "main.mjs"]
