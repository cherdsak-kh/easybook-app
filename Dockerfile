# syntax=docker/dockerfile:1.7
#
# Multi-stage build for easybook-app (React + Vite SPA, port 2200 in dev / served on :80 here).
#
# RUNTIME-SECRETS MODEL (matches easybook-service/Dockerfile — see that file for the pattern this
# was refactored to mirror): the shipped image is built COMPLETELY SECRET-FREE, with literal
# sentinel placeholders standing in for VITE_API_URL / VITE_LIFF_ID. Real values are resolved from
# Infisical and substituted into the compiled static assets at container START, not at image build
# time. This replaces an earlier build-time-Infisical design (see git history / prior
# claude_planning/20260713_1735_frontend_cicd/03_implement_log.md sections) that inlined real
# secrets into the image during `docker build` — that model required INFISICAL_TOKEN in CI and
# rebuilt the image per-environment. The runtime-substitution model below builds ONE portable,
# secret-free image and lets `docker compose`/`docker run` decide, per environment, which real
# values to inject — exactly how the backend already treats DATABASE_URL/SESSION_SECRET/etc.
#
# Why this is even possible for a static SPA: Vite normally inlines `VITE_*` into the JS bundle at
# `vite build` time with no server process left to resolve them later. We route around that by
# building against unique, regex/sed-safe sentinel tokens (`__VITE_API_URL_PLACEHOLDER__` /
# `__VITE_LIFF_ID_PLACEHOLDER__`) instead of real values, so the exact same tokens land verbatim in
# the compiled `dist/assets/*.js` (and are checked for in `.css`/`.html` too, though Vite does not
# actually place `import.meta.env` values there). `docker-entrypoint.sh` then does a literal
# string substitution over the built assets before nginx starts serving them.
#
# Targets:
#   infisical - fetches + checksum-verifies the pinned standalone Infisical CLI binary ONCE, same
#               version-pinned-tarball approach as easybook-service/Dockerfile (NOT `apk add
#               infisical`, which 404s against artifacts-cli.infisical.com; NOT the curl|bash
#               installer, an unpinned mutable-branch supply-chain dependency). COPY'd into
#               `runtime` below only — the `build` stage no longer needs Infisical at all, since it
#               builds against placeholders, never real secrets.
#   build     - installs deps (`.npmrc`'s `legacy-peer-deps=true` MUST be present before `npm ci` —
#               see the COPY line below; this repo's tree does not resolve without it, unlike the
#               backend) and runs a completely secret-free `vite build` against literal placeholder
#               `VITE_API_URL`/`VITE_LIFF_ID` ENV values. No Infisical CLI, no token, nothing
#               secret touches this stage.
#   runtime   - nginx:alpine serving the static dist/ (placeholders still present) plus the
#               Infisical CLI (binary only, no token baked in) and docker-entrypoint.sh /
#               docker-substitute-and-serve.sh. At container START, the entrypoint runs
#               `infisical run --` (INFISICAL_TOKEN/INFISICAL_PROJECT_ID/INFISICAL_ENV arrive as
#               plain runtime env vars, never baked into a layer), which resolves the real
#               VITE_API_URL/VITE_LIFF_ID and substitutes them into the built assets in place,
#               THEN execs nginx. No devDependencies, no source, no test files ship here either.
#
# Secrets: NOTHING is baked into any layer of this image — same guarantee as the backend. The
# `build` stage never sees an Infisical token because it never runs `infisical` at all. The
# `runtime` stage carries the Infisical CLI binary (not sensitive) but the actual INFISICAL_TOKEN
# only ever arrives via `docker run -e INFISICAL_TOKEN=...` / compose `environment:` at container
# runtime — never written to a Dockerfile ARG/ENV, never present in `docker history`.
#
# PUBLIC-NATURE CAVEAT (read before assuming Infisical/runtime-substitution makes these
# confidential): VITE_API_URL / VITE_LIFF_ID end up compiled into the client-side JS bundle and
# shipped to every browser that loads the app, exactly as before — runtime substitution changes
# WHEN the real value is written into the file (container start vs. image build), not WHETHER it
# ends up in public, served JS. They are PUBLIC regardless. Infisical here is about centralizing
# config management consistently with the backend and building one portable image per commit, NOT
# about confidentiality. See docs/staging-runbook.md.

# ---------------------------------------------------------------------------
# infisical (shared fetch stage; NOT the app image — just a fetch stage COPY'd into `runtime`)
# ---------------------------------------------------------------------------
FROM alpine:3.20 AS infisical
# Keep this version in sync with easybook-service/Dockerfile's own ARG INFISICAL_VERSION when
# bumping — same pinned release, same checksum-verification approach, verified there.
ARG INFISICAL_VERSION=0.43.104
WORKDIR /tmp
RUN apk add --no-cache curl ca-certificates \
    && curl -fsSLO "https://github.com/Infisical/cli/releases/download/v${INFISICAL_VERSION}/cli_${INFISICAL_VERSION}_linux_amd64.tar.gz" \
    && curl -fsSLO "https://github.com/Infisical/cli/releases/download/v${INFISICAL_VERSION}/checksums.txt" \
    && grep " cli_${INFISICAL_VERSION}_linux_amd64.tar.gz\$" checksums.txt > cli.sha256 \
    && sha256sum -c cli.sha256 \
    && tar xzf "cli_${INFISICAL_VERSION}_linux_amd64.tar.gz" infisical \
    && mv infisical /usr/local/bin/infisical \
    && chmod +x /usr/local/bin/infisical \
    && rm -rf /tmp/*

# ---------------------------------------------------------------------------
# build (secret-free — builds against literal placeholder sentinels, never real values)
# ---------------------------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app

# QA BUG-1 fix: .npmrc MUST be copied alongside package.json/package-lock.json BEFORE `npm ci`.
# This repo requires `legacy-peer-deps=true` (committed in .npmrc, NOT in .dockerignore) to
# resolve openapi-typescript's `peer typescript@^5.x` against this repo's `typescript@~6.0.2` —
# without it, `npm ci` fails with ERESOLVE inside the build (reproduced and routed by qa in
# claude_planning/20260713_1735_frontend_cicd/04_qa_log.md). Copying `.npmrc` into the same
# WORKDIR (/app) as package.json, before `npm ci` runs, is what makes npm pick it up — npm reads
# `.npmrc` from the current working directory.
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .

# Deliberately fake, non-secret sentinel values — unique, no regex/sed-special characters beyond
# underscores, extremely unlikely to collide with any real bundle content. Vite inlines whatever
# `VITE_*` values are present in `process.env` at `vite build` time (see vite.config.ts / Vite's
# own env-loading docs: process.env vars already present take priority over `.env` files), so
# setting these as plain Dockerfile ENV before `npm run build` is sufficient — no Infisical, no
# BuildKit secret mount, no `INFISICAL_*` anywhere in this stage. These are the ONLY two `VITE_*`
# vars the app consumes (confirmed via `grep -rn "import.meta.env.VITE_" src`:
# src/lib/liff.ts -> VITE_LIFF_ID, src/lib/api-client.ts -> VITE_API_URL — nothing else).
ENV VITE_API_URL=__VITE_API_URL_PLACEHOLDER__
ENV VITE_LIFF_ID=__VITE_LIFF_ID_PLACEHOLDER__

RUN npm run build

# ---------------------------------------------------------------------------
# runtime (Infisical CLI + entrypoint; substitutes placeholders for real values at container start)
# ---------------------------------------------------------------------------
FROM nginx:alpine AS runtime

# Infisical CLI binary, copied from the shared `infisical` stage above (checksum-verified there,
# NOT `apk add infisical` — see that stage's comment). No curl/bash/apk step here, no token
# present at build time — INFISICAL_TOKEN only arrives via `docker run -e INFISICAL_TOKEN=...` /
# compose `environment:` at container runtime, exactly like easybook-service/Dockerfile's runtime
# stage.
COPY --from=infisical /usr/local/bin/infisical /usr/local/bin/infisical

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Substitute-then-serve entrypoint (docker-entrypoint.sh, docker-substitute-and-serve.sh — both
# ops/config, not application source; see .dockerignore, which does not exclude *.sh). chmod +x
# here rather than relying on the host's file mode bit, since that bit is not reliably preserved
# across a Windows checkout.
COPY docker-entrypoint.sh /docker-entrypoint.sh
COPY docker-substitute-and-serve.sh /docker-substitute-and-serve.sh
RUN chmod +x /docker-entrypoint.sh /docker-substitute-and-serve.sh

EXPOSE 80

# No USER directive here (deliberately): the base nginx:alpine image starts its container process
# as root by default (only the spawned WORKER processes drop to the `nginx` user, per the `user
# nginx;` directive already present in the base image's own /etc/nginx/nginx.conf — our
# nginx.conf, mounted at /etc/nginx/conf.d/default.conf, only supplies the server{} block, it does
# not override that top-level `user` directive). That means docker-substitute-and-serve.sh, which
# rewrites files under /usr/share/nginx/html, runs as root and has write access — the substitution
# happens BEFORE nginx's own worker processes (which do run unprivileged) ever start.
ENTRYPOINT ["/docker-entrypoint.sh"]
