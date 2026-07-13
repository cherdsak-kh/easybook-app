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
# three env vars is unset or empty, before infisical run is even invoked.
set -eu

: "${INFISICAL_TOKEN:?INFISICAL_TOKEN must be set at container runtime (see docker-compose.staging.yml environment block) -- refusing to start rather than serve unsubstituted placeholder JS}"
: "${INFISICAL_PROJECT_ID:?INFISICAL_PROJECT_ID must be set at container runtime -- refusing to start rather than serve unsubstituted placeholder JS}"
: "${INFISICAL_ENV:?INFISICAL_ENV must be set at container runtime -- refusing to start rather than serve unsubstituted placeholder JS}"

# infisical run -- (no explicit --projectId/--env flags) matches EXACTLY how
# easybook-service/Dockerfile invokes it (ENTRYPOINT ["infisical", "run", "--"] for the
# migrator, CMD ["infisical", "run", "--", "node", "dist/main.js"] for the runtime app) -- both
# rely on the Infisical CLI picking up INFISICAL_PROJECT_ID/INFISICAL_ENV from the process
# environment rather than being passed as explicit CLI flags. `exec` replaces this shell process
# with infisical, and the Infisical CLI itself execs its child command (documented behavior --
# it does not fork/wait), so SIGTERM sent to the container PID 1 reaches nginx (started by
# docker-substitute-and-serve.sh own trailing exec nginx -g "daemon off;") through this whole
# chain, preserving clean-shutdown signal handling end to end.
exec infisical run -- /docker-substitute-and-serve.sh
