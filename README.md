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

| URL                                 | Service                                     |
|-------------------------------------|---------------------------------------------|
| https://app.dev.usespotlight.ai     | web — Vite dev server                       |
| https://app.dev.usespotlight.ai/api | control-plane — NestJS serves under the `/api` global prefix |

Source is bind-mounted into both containers, so edits on the host hot-reload
without a rebuild. Plain HTTP redirects to HTTPS.

## Schema changes

Edit `control-plane/src/infrastructure/persistence/drizzle/schema.ts`, then:

```bash
docker compose exec -T control-plane npm run db:generate -- --name=describe_the_change
docker compose up -d          # the migrate container applies it
```

Auth tables are generated from the better-auth config rather than written by
hand — run `npm run auth:generate` before generating a migration.
