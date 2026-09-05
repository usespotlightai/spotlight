# Spotlight

Monorepo with two services: `control-plane` (NestJS API backed by Postgres) and
`web` (React single-page app). Locally both run in Docker behind Traefik, which
terminates HTTPS and routes by path.

## Local setup

Prerequisites:
- [Docker](https://docs.docker.com/get-started/get-docker/) — runs every service, so nothing needs to be installed on the host
- [mkcert](https://github.com/FiloSottile/mkcert) — issues the locally-trusted certificate used for HTTPS

```bash
# 1. Point the dev domain at your machine. Traefik routes by Host header,
#    so the app is only reachable under this name.
echo "127.0.0.1 app.dev.usespotlight.ai" | sudo tee -a /etc/hosts

# 2. Trust a local CA (once, asks for your password), then issue the wildcard
#    certificate Traefik serves. Certificates are gitignored, so each clone
#    generates its own.
mkcert -install
(cd .docker/traefik/certs && mkcert "*.dev.usespotlight.ai")

# 3. Start Traefik, web, control-plane and Postgres. Database migrations run
#    first, in their own container.
docker compose up -d
```

| URL                                        | Service                                     |
|--------------------------------------------|---------------------------------------------|
| https://app.dev.usespotlight.ai            | web — Vite dev server                       |
| https://app.dev.usespotlight.ai/api        | control-plane — NestJS serves under the `/api` global prefix |
| https://app.dev.usespotlight.ai/api/install.sh | control-plane — the runner installer (see below) |

Source is bind-mounted into both containers, so edits on the host hot-reload
without a rebuild. Plain HTTP redirects to HTTPS.

## Installing a runner

A host becomes a runner in two steps. First install — the script downloads the
`runner` daemon and the `spotlight` CLI, puts them on PATH, and records which
control plane it came from:

```bash
curl -fsSL https://dev.usespotlight.ai/api/install.sh | bash
```

Then register, once, with a token minted when you enrol a runner in Spotlight.
It checks the token, saves it, and starts the runner (as a service where it
can):

```bash
runner register              # prompts for the token
runner register --token spot_…   # or pass it directly
```

The control plane serves only the script (`installer/install.sh`, bind-mounted
in dev so edits show up without a rebuild). On a tag, `release.yml` triggers the
`infrastructure` repo (as it does for the service images); that pipeline
cross-compiles the binaries and publishes them to the public
[`usespotlightai/cli`](https://github.com/usespotlightai/cli) releases — the
code repository is private, so it cannot host public downloads itself. The
script pulls `runner`/`spotlight` from `releases/latest/download` there; pin a
version with `SPOTLIGHT_VERSION`. The production runner image installs the very
same way, at build time (`.docker/runner/Dockerfile`).

The installer is served under `/api` like the rest of the control plane, so it
needs no routing of its own: `curl -fsSL https://app.dev.usespotlight.ai/api/install.sh`.

## Schema changes

Edit `control-plane/src/infrastructure/persistence/drizzle/schema.ts`, then:

```bash
docker compose exec -T control-plane npm run db:generate -- --name=describe_the_change
docker compose up -d          # the migrate container applies it
```

Auth tables are generated from the better-auth config rather than written by
hand — run `npm run auth:generate` before generating a migration.
