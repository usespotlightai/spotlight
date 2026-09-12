# Spotlight

Monorepo with two services: `control-plane` (NestJS API backed by Postgres) and
`web` (React single-page app). Locally both run in Docker behind Traefik, which
terminates HTTPS and routes by path.

## Local setup

Prerequisites:
- [Docker](https://docs.docker.com/get-started/get-docker/) — runs every service, so nothing needs to be installed on the host
- [mkcert](https://github.com/FiloSottile/mkcert) — issues the locally-trusted certificate used for HTTPS

```bash
# 1. Point the dev domains at your machine. Traefik routes by Host header,
#    so the app is only reachable under these names. The second is the
#    attachments bucket, named the way AWS names one.
echo "127.0.0.1 app.dev.usespotlight.ai files.dev.usespotlight.ai" | sudo tee -a /etc/hosts

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
| https://files.dev.usespotlight.ai          | storage — the attachments bucket (MinIO); browsers upload straight to it |
| http://localhost:8025                      | mail — every message the control plane sends (Mailpit)      |

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
runner register --token <token>   # or pass it directly
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

## Attachments

Files put to a task are kept in an S3 bucket. A browser never sends them
through the control plane: it asks for a signed address and uploads straight to
the bucket, and the file only joins a task once its id is sent with one.

Development runs MinIO under the bucket's own name — `files.dev.usespotlight.ai`
for a bucket called `files` — so an upload there is addressed exactly as one
against AWS. What a deployment sets:

| Variable | Development | Staging & production |
|---|---|---|
| `S3_BUCKET` | `files` — and so the name it is served at | the bucket's name |
| `S3_REGION` | `us-east-1` | the bucket's region |
| `S3_ENDPOINT` | `http://storage:9000` | unset — AWS |
| `S3_FORCE_PATH_STYLE` | `true` — one address serves every bucket | unset |
| `S3_PUBLIC_ENDPOINT` | `https://dev.usespotlight.ai` | unset, or a CDN in front of the bucket |
| `S3_PUBLIC_FORCE_PATH_STYLE` | unset — the bucket names itself in the host | unset |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | `spotlight` / `spotlight-storage` | the key pair for the bucket's user |

The bucket itself needs three things, none of which this repository provisions:

1. **Public access blocked.** Everything is read and written through signed
   addresses that last fifteen minutes.
2. **CORS**, so a browser may upload to it from the app:

   ```json
   [{ "AllowedOrigins": ["https://app.example.com"],
      "AllowedMethods": ["PUT", "GET"],
      "AllowedHeaders": ["content-type", "x-amz-meta-uploader", "x-amz-meta-name"],
      "ExposeHeaders": [], "MaxAgeSeconds": 3000 }]
   ```

3. **A lifecycle rule** expiring objects under `workspaces/` that no task ever
   claimed, since an upload nobody attaches is never read again.

The key pair needs `s3:PutObject`, `s3:GetObject` and `s3:DeleteObject` on
`arn:aws:s3:::<bucket>/workspaces/*` and nothing else.

## Invitations

Somebody is asked onto a team from Settings > Members. The invitation is an
address and a link: the token in the link is hashed before it is stored, so the
database holds a list of who was asked and nothing that opens anything. The
link is followed, signed in as the address it was sent to, and accepting joins
the team and the workspace it belongs to. It runs out after a fortnight, and
asking again replaces the link rather than adding a second one.

Sending needs an SMTP server, named in one variable:

| Variable | Development | Staging & production |
|---|---|---|
| `SMTP_URL` | `smtp://mail:1025` — the Mailpit container | the provider's URL, as in `smtps://user:pass@smtp.example.com:465` |
| `MAIL_FROM` | `Spotlight <noreply@dev.usespotlight.ai>` | an address the domain is allowed to send from |

Development sends to Mailpit, which shows every message at
<http://localhost:8025> and delivers none of them. Where `SMTP_URL` is unset
nothing is sent at all: the message, link included, is written to the log, so a
deployment that has not configured mail still leaves a trail of what it owed.

Links point at `SPOTLIGHT_PUBLIC_URL`, or at `BETTER_AUTH_URL` where that is
unset.

## Schema changes

Edit `control-plane/src/infrastructure/persistence/drizzle/schema.ts`, then:

```bash
docker compose exec -T control-plane npm run db:generate -- --name=describe_the_change
docker compose up -d          # the migrate container applies it
```

Auth tables are generated from the better-auth config rather than written by
hand — run `npm run auth:generate` before generating a migration.
