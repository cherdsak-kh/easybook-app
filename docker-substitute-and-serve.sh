#!/bin/sh
# Runs INSIDE `infisical run --` (invoked by docker-entrypoint.sh), so VITE_API_URL / VITE_LIFF_ID
# are real, Infisical-resolved values in this process environment by the time this script
# starts. Substitutes the build-time sentinel placeholders in the compiled static assets, verifies
# nothing was left unsubstituted, then execs nginx in the foreground.
set -eu

HTML_DIR=/usr/share/nginx/html

# EASYBOOK_CONFIG_SOURCE=degraded means docker-entrypoint.sh could not reach Infisical and is
# retrying with no resolved values at all (see the incident note in that file). There is nothing
# to substitute in that mode -- skip straight to the placeholder guard below, which is what
# decides whether this container can serve: assets substituted by a previous successful start
# pass it, a fresh never-substituted image fails it. Every other value (including unset, i.e. a
# direct `docker run` of this script) takes the normal path.
if [ "${EASYBOOK_CONFIG_SOURCE:-infisical}" = 'degraded' ]; then
  echo "WARNING: serving previously substituted assets without re-resolving configuration." >&2
else
  # VITE_API_URL must resolve to something for a working deploy (an empty value would make the SPA
  # call same-origin /api/... against a static nginx server with no such route -- see
  # docs/staging-runbook.md). VITE_LIFF_ID is intentionally NOT required here -- it is documented as
  # optional/fail-soft (src/lib/liff.ts initLiff() never throws on an unset LIFF id; see
  # easybook-app/CLAUDE.md "LIFF integration is isolated and fails soft" section) -- requiring it
  # at the infra layer would contradict that app-level contract.
  : "${VITE_API_URL:?VITE_API_URL did not resolve from Infisical (project/env may be missing the key) -- refusing to serve unsubstituted placeholder JS}"
  VITE_LIFF_ID="${VITE_LIFF_ID:-}"
fi

# sed-safety: VITE_API_URL is a URL and WILL contain slashes (and may contain ampersands,
# backslashes, colons, etc). Using the default "/" sed delimiter with an un-escaped value would
# corrupt the command (or silently substitute the wrong thing) the moment the value contains a
# slash. Standard fix: escape every character in the replacement text that is special to sed
# replacement-side syntax -- backslash, "/" (our chosen delimiter), and "&" (whole-match
# backreference) -- with a backslash, via a throwaway sed pass over the value itself before it is
# ever used as a replacement. The escaped value is then safe to interpolate into
# s/<placeholder>/<escaped>/g even when the delimiter is still "/", because every literal "/"
# inside it is now the escaped, non-delimiter sequence \/. The placeholder token itself
# (__VITE_..._PLACEHOLDER__) has no regex-special characters of its own, so it needs no escaping
# on the pattern side.
substitute() {
  placeholder="$1"
  value="$2"
  escaped_value=$(printf '%s' "$value" | sed -e 's/[\/&\\]/\\&/g')
  # busybox find/xargs/sed (nginx:alpine toolchain, not GNU coreutils) -- all flags used below
  # (-print0/-0/-i) are supported by busybox applets. Only text asset types can plausibly
  # contain the placeholder: Vite inlines import.meta.env only into JS output, but .css/.html are
  # covered too in case a future change ever embeds a VITE_* value there (e.g. an inline script in
  # index.html) -- cheap to include, and it means this substitution does not silently stop working
  # if that ever changes.
  find "$HTML_DIR" -type f \( -name '*.js' -o -name '*.css' -o -name '*.html' \) -print0 \
    | xargs -0 sed -i "s/${placeholder}/${escaped_value}/g"
}

if [ "${EASYBOOK_CONFIG_SOURCE:-infisical}" != 'degraded' ]; then
  substitute '__VITE_API_URL_PLACEHOLDER__' "$VITE_API_URL"
  substitute '__VITE_LIFF_ID_PLACEHOLDER__' "$VITE_LIFF_ID"
fi

# Fail loud: if a placeholder survives substitution (a mistyped sentinel, a file type this script
# did not scan, or a sed invocation that silently no-oped), abort rather than let nginx boot and
# serve JS containing the literal __VITE_..._PLACEHOLDER__ string to real browsers -- that failure
# mode is strictly worse than the container refusing to start, because it looks "up" to the CD
# health gate (GET / still returns 200) while being functionally broken for every user.
#
# This guard is also what makes the entrypoint's degraded path safe, and is load-bearing there
# rather than merely defensive: in that mode nothing was substituted at all, so surviving
# placeholders mean this container has never had real values written into it (a fresh image whose
# first-ever start could not reach Infisical). Serving that would ship literal placeholder strings
# to browsers, so it must abort exactly as it always did -- the fallback only ever rescues a
# container that was already serving correctly.
if grep -rlq '__VITE_[A-Z_]*_PLACEHOLDER__' "$HTML_DIR"; then
  if [ "${EASYBOOK_CONFIG_SOURCE:-infisical}" = 'degraded' ]; then
    echo "ERROR: Infisical was unreachable AND these assets were never substituted by an earlier successful start -- there is no configuration to serve. Restore connectivity to Infisical and redeploy." >&2
  else
    echo "ERROR: unsubstituted __VITE_*_PLACEHOLDER__ sentinel still present after substitution -- aborting startup rather than serving broken JS." >&2
  fi
  grep -rl '__VITE_[A-Z_]*_PLACEHOLDER__' "$HTML_DIR" >&2 || true
  exit 1
fi

# exec so nginx (the ultimate child of PID 1, replacing this shell) receives SIGTERM directly for
# a clean container stop, matching the backend own foreground-process, daemon-off pattern.
exec nginx -g 'daemon off;'
