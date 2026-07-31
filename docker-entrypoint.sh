#!/bin/sh
# Runtime entrypoint for the easybook-app (nginx) container.
#
# Runtime-secrets model (mirrors easybook-service/Dockerfile CMD ["infisical", "run", "--",
# "node", "dist/main.js"]): the image shipped by `docker build` is secret-free -- the compiled JS
# under /usr/share/nginx/html still contains the literal sentinel placeholders
# __VITE_API_URL_PLACEHOLDER__ / __VITE_LIFF_ID_PLACEHOLDER__ baked in at BUILD time (see
# Dockerfile build stage). This script resolves the REAL VITE_API_URL/VITE_LIFF_ID from
# Infisical at container START, via `infisical run --`, then hands off to
# docker-substitute-and-serve.sh (which runs INSIDE that infisical run invocation, so it sees
# the real values as ordinary environment variables) to rewrite the static assets and finally exec
# nginx.
#
# Fail loud: INFISICAL_TOKEN / INFISICAL_PROJECT_ID / INFISICAL_ENV are required. A container that
# boots but silently serves the literal placeholder strings is worse than one that refuses to
# start -- ${VAR:?message} aborts immediately (with the given message on stderr) if any of these
# three env vars is unset or empty, before infisical run is even invoked. A missing token is a
# DEPLOY defect, so it stays fatal even in the degraded path below.
set -eu

: "${INFISICAL_TOKEN:?INFISICAL_TOKEN must be set at container runtime (see docker-compose.staging.yml environment block) -- refusing to start rather than serve unsubstituted placeholder JS}"
: "${INFISICAL_PROJECT_ID:?INFISICAL_PROJECT_ID must be set at container runtime -- refusing to start rather than serve unsubstituted placeholder JS}"
: "${INFISICAL_ENV:?INFISICAL_ENV must be set at container runtime -- refusing to start rather than serve unsubstituted placeholder JS}"

# ---------------------------------------------------------------------------
# Reachability probe, and why a degraded path exists at all
# ---------------------------------------------------------------------------
# INCIDENT (2026-07-30/31): every start attempt died here with
#   x509: certificate is not valid for any names, but wanted to match app.infisical.com
# -- a TLS-interception/egress failure on the host's network, not a bad token and not a config
# error. `restart: unless-stopped` retried, each attempt hit the same wall, and the SPA stayed
# down until the network recovered.
#
# That downtime was gratuitous. The substitution below rewrites the asset files IN PLACE, on the
# container's own writable layer, and a restart brings back the SAME container -- so on any
# restart after a successful first start, /usr/share/nginx/html ALREADY contains the real values
# and there is nothing left for Infisical to supply. The container was refusing to serve correct
# files that were sitting on disk the whole time.
#
# So: probe first. `infisical run -- true` uses the EXACT code path the real invocation uses (no
# dependency on `infisical export` or its output format), and the CLI exits non-zero without
# running the child when it cannot fetch. On success, nothing changes -- the normal path runs and
# re-substitutes from freshly resolved values. On failure we do NOT give up; we hand off to
# docker-substitute-and-serve.sh in degraded mode, where the pre-existing placeholder guard
# decides the outcome:
#   - assets already substituted (a previous start succeeded) -> serve them, loudly warned
#   - placeholders still present (fresh image, first-ever start) -> abort, exactly as before
# A brand-new deploy therefore still fails loud when Infisical is unreachable, which is what the
# CD health gate is there to catch; only the restart-an-already-working-container case is
# rescued. Deliberately NO cached-values file and no volume: the substituted asset tree IS the
# cache, so there is no second copy of the config to drift, expire, or manage.
probe_stderr=/tmp/infisical-probe.err
if infisical run -- true >/dev/null 2>"$probe_stderr"; then
  rm -f "$probe_stderr"
  # `exec` replaces this shell process with infisical, and the Infisical CLI forwards signals to
  # the child it spawns, so the container's stop signal reaches nginx (started by
  # docker-substitute-and-serve.sh's own trailing `exec nginx -g "daemon off;"`) through this
  # whole chain -- observed in staging as `signal 3 (SIGQUIT) received from 1` in nginx's log,
  # followed by a clean `exit`. (An earlier version of this comment claimed the CLI execs its
  # child, making nginx PID 1; it does not -- nginx runs as a child of the CLI, which stays PID
  # 1. Signal handling is correct either way, but the mechanism is forwarding, not exec.)
  exec infisical run -- /docker-substitute-and-serve.sh
fi

echo "WARNING: could not resolve configuration from Infisical at startup. CLI output:" >&2
cat "$probe_stderr" >&2 || true
rm -f "$probe_stderr"
echo "WARNING: falling back to whatever this container's assets were substituted with on a previous successful start (see docs/staging-runbook.md). Configuration changes made in Infisical since then are NOT picked up -- redeploy once connectivity is restored." >&2

EASYBOOK_CONFIG_SOURCE=degraded
export EASYBOOK_CONFIG_SOURCE
exec /docker-substitute-and-serve.sh
