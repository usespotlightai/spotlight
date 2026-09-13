# Spotlight

| Path | What |
|---|---|
| `control-plane/` | NestJS API on Postgres |
| `web/` | React SPA (Vite) |
| `runner/` | Go `runner` daemon and `spotlight` CLI |
| `installer/` | `install.sh`, served by the control plane |

Locally everything runs in Docker behind Traefik, which terminates HTTPS and
routes by host and path. Source is bind-mounted, so edits hot-reload.

## Local setup

Requires [Docker](https://docs.docker.com/get-started/get-docker/) and
[mkcert](https://github.com/FiloSottile/mkcert).

```bash
echo "127.0.0.1 app.dev.usespotlight.ai files.dev.usespotlight.ai" | sudo tee -a /etc/hosts
mkcert -install
(cd .docker/traefik/certs && mkcert "*.dev.usespotlight.ai")
cp .env.example .env    # fill in, see below
docker compose up -d
```

`.env`, documented inline in `.env.example`:

| Variable | Needed for |
|---|---|
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | sign-in; the control plane won't start without them |
| `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY` | cloning and pushing; required to start |
| `GITHUB_WEBHOOK_SECRET`, `CLOUDFLARE_TUNNEL_TOKEN` | GitHub webhooks reaching this machine |
| `RUNNER_ONE_TOKEN`, `RUNNER_TWO_TOKEN` | the two compose runners, from Settings > Runners |
| `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` | agents on those runners |

| URL | Service |
|---|---|
| https://app.dev.usespotlight.ai | web |
| https://app.dev.usespotlight.ai/api | control-plane |
| https://files.dev.usespotlight.ai | storage (MinIO attachments bucket) |
| http://localhost:8025 | mail (Mailpit; catches all outgoing mail) |

Compose also runs `db`, `migrate` (applies migrations before the control plane
starts), `storage-bucket` and `tunnel`.

## Installing a runner

```bash
curl -fsSL https://app.dev.usespotlight.ai/api/install.sh | bash
runner register [--token <token>] [--url <control-plane>]
```

The script installs `runner` and `spotlight` onto PATH from the public
[`usespotlightai/cli`](https://github.com/usespotlightai/cli) releases (pin with
`SPOTLIGHT_VERSION`). `register` checks the token (minted when you enrol a
runner), saves it, and starts the runner, as a service where it can. The
production runner image installs the same way (`.docker/runner/Dockerfile`).

Tagging triggers `release.yml`, which starts the `infrastructure` repo's build:
service images, plus binaries published to `usespotlightai/cli`, since this
repository is private.

## Schema changes

Edit `control-plane/src/infrastructure/persistence/drizzle/schemas/`, then:

```bash
docker compose exec -T control-plane npm run db:generate -- --name=describe_the_change
docker compose up -d
```

Migrations are generated, never hand-written. Auth tables come from the
better-auth config: run `npm run auth:generate` first.

## Configuration

Validated at startup by `control-plane/src/infrastructure/config/env.schema.ts`.
Beyond `.env`:

| Variable | Purpose |
|---|---|
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | session signing; public app URL |
| `SPOTLIGHT_PUBLIC_URL` | base for install script and invite links; defaults to `BETTER_AUTH_URL` |
| `SPOTLIGHT_WEBHOOK_URL` | base for integrations' delivery URLs; defaults to `SPOTLIGHT_PUBLIC_URL`, then `BETTER_AUTH_URL` |
| `SPOTLIGHT_SECRETS_KEY` | seals each team's vault key and host connection tokens in the database; losing it leaves vaults readable only with a key a team kept (`openssl rand -base64 32`) |
| `OUTBOUND_ALLOWED_HOSTS` | comma-separated hosts integrations and their tools may call; empty allows none (`compose.yml` defaults it to `slack.com`) |
| `OAUTH_CLIENTS` | shared OAuth2 apps as JSON, e.g. `{"slack":{"id":"…","secret":"…"}}` |

### Attachments

Browsers upload straight to S3 through presigned URLs (15 minutes); a file
joins a task only once its id is sent with one. In development MinIO serves the
bucket under its own hostname, so addressing matches AWS.

| Variable | Development | Production |
|---|---|---|
| `S3_BUCKET` | `files` | bucket name |
| `S3_REGION` | `us-east-1` | bucket region |
| `S3_ENDPOINT` | `http://storage:9000` | unset |
| `S3_FORCE_PATH_STYLE` | `true` | unset |
| `S3_PUBLIC_ENDPOINT` | `https://dev.usespotlight.ai` | unset, or a CDN |
| `S3_PUBLIC_FORCE_PATH_STYLE` | unset | unset |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | `spotlight` / `spotlight-storage` | bucket user's keys |

The bucket, not provisioned here, needs:

1. Public access blocked.
2. CORS:
   ```json
   [{ "AllowedOrigins": ["https://app.example.com"],
      "AllowedMethods": ["PUT", "GET"],
      "AllowedHeaders": ["content-type", "x-amz-meta-uploader", "x-amz-meta-name"],
      "ExposeHeaders": [], "MaxAgeSeconds": 3000 }]
   ```
3. A lifecycle rule expiring unclaimed objects under `workspaces/`.

The key pair needs only `s3:PutObject`, `s3:GetObject` and `s3:DeleteObject` on
`arn:aws:s3:::<bucket>/workspaces/*`.

### Mail

Invitations (Settings > Members) are emailed links. The token is stored
hashed, expires after 14 days, and re-inviting replaces it.

| Variable | Development | Production |
|---|---|---|
| `SMTP_URL` | `smtp://mail:1025` | e.g. `smtps://user:pass@smtp.example.com:465` |
| `MAIL_FROM` | `Spotlight <noreply@dev.usespotlight.ai>` | a permitted sender |

With `SMTP_URL` unset, messages are logged instead of sent.
