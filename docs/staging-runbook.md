# Staging deploy — external prerequisites & recovery runbook (frontend)

Mirrors `easybook-service/docs/staging-runbook.md`'s shape, scoped to `easybook-app`. Things this
repo's CI/CD cannot fix by itself because they live outside it (server config, DNS/reverse-proxy
routing, GHCR credential provisioning). Verify each before trusting the corresponding claim made
elsewhere (`Dockerfile`, `docker-compose.staging.yml`).

## Required GitHub Secrets (configure before first deploy)

Every `secrets.*` reference in `.github/workflows/ci.yml` and `.github/workflows/cd.yml`, derived
directly from the (post-refactor) workflow files (not guessed). There are no `vars.*` (GitHub repo
Variables) references anywhere in either workflow — the frontend's config (`VITE_API_URL`,
`VITE_LIFF_ID`) is sourced from **Infisical**, the same secret-management tool the backend uses,
resolved at **container runtime** (not image build time — see the Infisical section below).
Configure all of these in the repo's **Settings → Secrets and variables → Actions** before the
first deploy. A missing secret resolves to an empty string at runtime (except `STAGING_SSH_PORT`,
which has an explicit `'22'` fallback) and will fail the corresponding step, usually at SSH
connect, GHCR auth, or the container's `docker-entrypoint.sh` (which refuses to start rather than
serve unsubstituted placeholder JS — see the Infisical section below).

- [ ] **`GITHUB_TOKEN`** — GHCR login for pushing the image. Auto-provided by GitHub Actions; not a
  repo secret you create — listed here only because it appears in the workflow. Used in: **CI**
  (`build-and-push` job, `docker/login-action`). Requires the repo setting below (`packages: write`).
- [ ] **`INFISICAL_TOKEN`** — Infisical machine-identity token used to resolve `VITE_API_URL` /
  `VITE_LIFF_ID` at **container start**. Injected into the CD SSH session's env from this secret,
  exported before `docker compose up -d`, and passed into the frontend container via
  `docker-compose.staging.yml`'s `environment:` block — never written to a Dockerfile `ARG`/`ENV`,
  never present in `docker history`, never present in the image CI builds. Used in: **CD**
  (`deploy` job).
- [ ] **`INFISICAL_PROJECT_ID`** — Infisical project ID paired with `INFISICAL_TOKEN`. Same
  runtime-injection treatment as `INFISICAL_TOKEN` above, matching the backend's `cd.yml`. Used
  in: **CD** (`deploy` job).
- [ ] **`STAGING_SSH_HOST`** — hostname/IP of the staging server (the SAME box the backend deploys
  to). Used in: **CD** (both the `appleboy/scp-action` compose-file copy step and the
  `appleboy/ssh-action` deploy step).
- [ ] **`STAGING_SSH_PORT`** — custom SSH port for the staging server. Falls back to `'22'` via
  `${{ secrets.STAGING_SSH_PORT || '22' }}` if unset. Used in: **CD** (same two steps). If the
  backend repo already has this configured for the same box, use the same value here (separate
  repo, separate secret store — it must be set again in this repo).
- [ ] **`STAGING_SSH_USER`** — SSH username for the staging server. Used in: **CD** (same two steps).
- [ ] **`STAGING_SSH_KEY`** — SSH private key for staging server auth. Used in: **CD** (same two
  steps).
- [ ] **`GHCR_PULL_USER`** — service-account username for the staging server's persistent
  `docker login ghcr.io` pull credential. This is the SAME credential the backend already
  provisioned on this box (see `easybook-service/docs/staging-runbook.md` §3) — no new
  provisioning needed server-side, just re-add the value as a secret in THIS repo (secrets do not
  cross repos). Used in: **CD** (deploy SSH step).
- [ ] **`GHCR_PULL_TOKEN`** — the GitHub PAT (`read:packages`) paired with `GHCR_PULL_USER`. Same
  reuse note as above. Used in: **CD** (same SSH step).

**`INFISICAL_ENV`** is NOT a secret — it is hardcoded `staging` directly in `cd.yml`'s `deploy`
job env block, matching the backend `cd.yml`'s own literal `INFISICAL_ENV: staging`. Nothing to
configure for it.

## Infisical: `VITE_API_URL` / `VITE_LIFF_ID` are resolved at container RUNTIME, not image build time

`VITE_API_URL` and `VITE_LIFF_ID` are stored in the **Infisical project** identified by
`INFISICAL_PROJECT_ID`, under the `staging` environment (or whichever `INFISICAL_ENV` is passed).
They are **not** GitHub repo Variables (no `vars.*` reference exists in either workflow) and, as of
this refactor, they are also **no longer resolved at image build time**.

**Runtime-substitution model (now matches the backend's runtime-secrets pattern exactly):** the
image CI builds and pushes to GHCR is **completely secret-free** — the Dockerfile's `build` stage
compiles Vite against two literal, non-secret sentinel values (`__VITE_API_URL_PLACEHOLDER__` /
`__VITE_LIFF_ID_PLACEHOLDER__`) instead of real config, so the exact same image is portable across
every environment (staging, a future prod, a local smoke test) without a rebuild. At **container
START**, the shipped `runtime` stage's `docker-entrypoint.sh` runs `infisical run --` (with
`INFISICAL_TOKEN`/`INFISICAL_PROJECT_ID`/`INFISICAL_ENV` supplied as plain container `environment:`
vars by `docker-compose.staging.yml`, injected by `cd.yml`'s SSH deploy step from GitHub Secrets —
see §2 below, which is now the opposite of what it used to say), resolves the real values, and
`docker-substitute-and-serve.sh` rewrites the compiled static assets in place before nginx starts.
This is the SAME shape as the backend's `CMD ["infisical", "run", "--", "node", "dist/main.js"]` —
the frontend previously differed because Vite normally has no runtime process left to resolve
secrets, which the placeholder-then-substitute trick routes around.

**PUBLIC-NATURE CAVEAT — read this before assuming Infisical or runtime substitution makes these
confidential:** `VITE_API_URL` and `VITE_LIFF_ID` are compiled into the client-side JS bundle and
shipped to **every browser** that loads the app, exactly as before. Moving the substitution to
container start changes **when** the real value is written into the served file, not **whether**
it ends up in public, served JS — they are inherently **public** either way. Sourcing them from
Infisical centralizes config management consistently with the backend (one place to look, one tool
for both repos, one portable image) — it does **not** make a LIFF ID or API URL confidential. Never
store an actual secret (a real credential, a private key, etc.) under these Infisical keys
expecting it to stay hidden from end users; if that need ever arises, it belongs on the backend,
not compiled into this SPA.

- If `INFISICAL_TOKEN`/`INFISICAL_PROJECT_ID`/`INFISICAL_ENV` are **missing or invalid** at
  container start (bad/absent token, wrong project id, no network access to Infisical),
  `docker-entrypoint.sh` fails loudly and the container never serves traffic — see the fail-loud
  behavior documented in `Dockerfile`/`docker-entrypoint.sh`/`docker-substitute-and-serve.sh`
  (missing env vars abort immediately via `${VAR:?message}`; a placeholder surviving substitution
  also aborts startup rather than serving broken JS). The CD health gate (`GET /` on `:2200`) will
  then correctly fail the deploy instead of reporting a false "up" on a broken container.
- If the **individual keys** `VITE_API_URL`/`VITE_LIFF_ID` simply do not exist yet in the Infisical
  project/environment (token and project ARE valid), `infisical run` does not fail — it just does
  not inject them, and the entrypoint's own checks then decide: an unresolved `VITE_API_URL` is
  **required** (the entrypoint aborts — an empty value would make the deployed SPA call
  same-origin `/api/...` against a static nginx server with no such route), while an unresolved
  `VITE_LIFF_ID` is optional and fails soft (substituted with an empty string, matching the
  documented generic-greeting fallback in `src/lib/liff.ts`).

## Repo settings

- **Actions → General → Workflow permissions**: must allow `packages: write` (or the
  `build-and-push` job's explicit `permissions: { packages: write }` block must be honored — some
  org-level policies still gate this at the repo/org settings level even when the workflow
  declares it). Without this, `docker/build-push-action`'s push step fails with a GHCR permission
  error even though `GITHUB_TOKEN` is present.
- **Package visibility**: the first push creates `ghcr.io/<owner>/easybook-app`. By default GHCR
  packages inherit a private visibility tied to the pushing actor/repo; the staging server's
  `GHCR_PULL_USER`/`GHCR_PULL_TOKEN` credential (reused from the backend, `read:packages` scope)
  must have read access to this new package too — GHCR grants this automatically for a token
  scoped at the org/user level, but verify after the first push if the pull step in CD 401s.

## 1. Reverse-proxy routing (hard prerequisite, external to this repo)

The frontend nginx container publishes `2200:80` on the staging host (see
`docker-compose.staging.yml`) — the SAME box the backend publishes `3300:3300` on. There is no
Nginx/Cloudflare config in this repo (same as the backend's staging-runbook §1 disclaimer) — the
outer reverse proxy (documented, not owned, by `easybook-service/docs/staging-runbook.md` §1: the
Cloudflare → Nginx chain in front of the backend) is expected to also route the public frontend
hostname/path to `127.0.0.1:2200` on this box, e.g.:

```nginx
server {
    listen 443 ssl;
    server_name staging.example.com;  # the SPA's public hostname — replace

    location / {
        proxy_pass http://127.0.0.1:2200;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

If the frontend and backend are meant to share a single public origin (e.g. `staging.example.com/`
for the SPA and `staging.example.com/api/` for the backend, avoiding CORS entirely), that routing
split is also an outer-Nginx decision, not something either repo's compose file controls — verify
whichever layout is chosen actually matches the `VITE_API_URL` value stored in Infisical and
substituted into the served assets at container start (§ above), since a mismatch there means the
deployed SPA calls the wrong origin and every request fails with either a 404 or a CORS error
depending on which way it is wrong.

**This must be verified on the staging box before the first real CD run** — the health gate inside
`cd.yml` only proves the container itself answers `GET /` on `127.0.0.1:2200`; it does not (and
cannot, from inside CI) prove the outer reverse proxy is routing the public hostname to it.

## 2. Runtime secrets — Infisical is now a `cd.yml` (deploy-time) concern, matching the backend

As of this refactor, this frontend container has the **same runtime secret surface shape as the
backend**: `docker-compose.staging.yml` declares an `environment:` block for `INFISICAL_TOKEN` /
`INFISICAL_PROJECT_ID` / `INFISICAL_ENV`, sourced from the host env `cd.yml`'s SSH deploy step
exports (from GitHub Secrets) immediately before `docker compose up -d`. `ci.yml`'s
`build-and-push` job carries **no** Infisical wiring at all — it builds and pushes a secret-free
image containing only literal placeholder sentinels; there is nothing for CI to resolve. Do not
move this wiring back into `ci.yml` "for consistency with the old model" — the whole point of this
refactor is that CI never needs Infisical credentials at all, and the same pushed image is valid
for every environment.

## 3. Recovery runbook — partial-failure states

The CD workflow (`cd.yml`) propagates every SSH/SCP step's exit code (no `|| true`, no swallowed
errors, no `script_stop: true` on the ssh-action — see the comment in `cd.yml` for why that option
is deliberately absent), so a failure anywhere fails the whole workflow loudly.

| Failure point | Server state | How to check | Fix-forward |
|---|---|---|---|
| SCP of `docker-compose.staging.yml` fails | Old compose file (or none) on disk; old frontend container still running untouched | `ssh` in, `cat ~/easybook-app/docker-compose.staging.yml` | Re-run the workflow; nothing was touched yet. |
| `docker login` (GHCR) fails | Old frontend container still running untouched | Check `GHCR_PULL_TOKEN` expiry — same credential/rotation as the backend, see `easybook-service/docs/staging-runbook.md` §3 | Rotate `GHCR_PULL_TOKEN` (in both repos' secret stores if rotated), re-run. |
| `docker pull` fails | Old frontend container still running untouched | Check network/GHCR status and package visibility (see repo settings above), retry | Re-run once the pull succeeds. |
| `docker compose up -d` fails | Frontend container may be stopped/absent — **possible downtime window for the SPA only**, backend unaffected (separate container, no shared network) | `docker ps`, `docker compose -f docker-compose.staging.yml ps` | Fix whatever `up -d` reported (image pull, resource limit, port 2200 conflict) and re-run `up -d`. There is no migration step to worry about re-running — this is a stateless static server. |
| Post-deploy `GET /` poll times out | New frontend container exited or never reached nginx — as of this refactor, this can now ALSO be `docker-entrypoint.sh` failing loudly: missing/invalid `INFISICAL_TOKEN`/`INFISICAL_PROJECT_ID`/`INFISICAL_ENV`, an Infisical auth/network failure, an unresolved `VITE_API_URL`, or a placeholder surviving substitution (all deliberate fail-loud exits — see `docker-entrypoint.sh` / `docker-substitute-and-serve.sh`) — in addition to the older causes (nginx misconfiguration, corrupted image, resource limit hit) | `docker logs easybook-app`, hit `curl -s localhost:2200/` on the server directly | Check `docker logs` first: an entrypoint failure prints an explicit `ERROR:`/`must be set` message naming the missing var or the unsubstituted file, which is different from an nginx startup error — fix the underlying Infisical secret/config, or nginx.conf/image if it truly is nginx. |

## 4. Image retention / disk hygiene

Same policy as the backend (`easybook-service/docs/staging-runbook.md` §5): `cd.yml`'s deploy step
ends with `docker image prune -f` scoped to dangling images only. GHCR-side retention for
`easybook-app`'s SHA-tagged images is the same unaddressed follow-up noted for the backend — left
for a future `devops` task once there is real deploy volume to justify automating it (anti-
over-engineering guardrail).
