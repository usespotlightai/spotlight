# Spotlight

| Path | What |
|---|---|
| `control-plane/` | NestJS API on Postgres |
| `web/` | React SPA (Vite) |
| `data-plane/` | Go: one binary, `cmd/spotlight`, whose roles are `host/` (`spotlight host`), `runner/` (`spotlight runner`, one run in a sandbox) and `agent/` (the commands agents talk back with); they share only `protocol/` and `control/`. `install.sh` installs it as a host and is served by the control plane |

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
| `DEV_POOL_TOKEN` | the dev pull pool the compose `host` serves (`scripts/dev-setup.mjs` creates it) |
| `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` | Claude Code agents in the host's sandboxes |
| `OPENAI_API_KEY` | Codex agents in the host's sandboxes |

| URL | Service |
|---|---|
| https://app.dev.usespotlight.ai | web |
| https://app.dev.usespotlight.ai/api | control-plane |
| https://files.dev.usespotlight.ai | storage (MinIO attachments bucket) |
| http://localhost:8025 | mail (Mailpit; catches all outgoing mail) |

Compose also runs `db`, `migrate` (applies migrations before the control plane
starts), `storage-bucket`, `tunnel`, and `host`: a `spotlight host` serving the
dev pool, which starts sandboxes from the `spotlight-runner:dev` image on the
compose network. It reloads on edits to `data-plane/`; the image does not, so
rebuild it with `docker compose build runner` after changing the runner or agent commands.

## Hosts and runners

Every run gets a fresh runner in a sandbox of its own, destroyed after the run.
A *host* is any machine that starts them: set it up once with a pull pool's
token, and it claims work for the pool, starts a container from the runner
image for each piece of work and hands it that run's one-run credential, never
its own.

```bash
curl -fsSL https://app.dev.usespotlight.ai/api/install.sh | SPOTLIGHT_TOKEN=<pool token> sh
```

The script installs only `spotlight`, pinned to the control plane's
release (`SPOTLIGHT_VERSION` overrides it), from the public
[`usespotlightai/spotlight`](https://github.com/usespotlightai/spotlight) releases. It
checks for Docker or Podman (on macOS: Docker Desktop, OrbStack or Colima),
pulls the runner image, writes `/etc/spotlight/host.env` (as root) or
`~/.spotlight/host.env`, and runs `spotlight host` as a systemd service or a launchd agent. It
asks nothing, so cloud-init can run it. A platform workload claims through a
runner trust instead: `SPOTLIGHT_TRUST=<trust id>` and
`SPOTLIGHT_OIDC_TOKEN_FILE=<projected token>`.

| Host variable | Default | What |
|---|---|---|
| `SPOTLIGHT_CAPACITY` | `1` | sandboxes at once |
| `SPOTLIGHT_RUNNER_IMAGE` | `ghcr.io/usespotlightai/spotlight-runner:<release>` | the host's default and allow-list, comma-separated: exact images, or prefixes ending in `*` such as `ghcr.io/acme/*`. The first exact image runs every line that names none. The host also serves each image a line names that an entry admits, and reports the rest as refused |
| `SPOTLIGHT_REGISTRY_CONFIG` | `$DOCKER_CONFIG/config.json` or `~/.docker/config.json` | Docker `auths` the host pulls with; read on every pull, and without it the host pulls anonymously |
| `SPOTLIGHT_SANDBOX_ENV` | `sandbox.env` beside `host.env` | variables every sandbox gets. Harness keys set here (`ANTHROPIC_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN`, `OPENAI_API_KEY`, `CODEX_API_KEY`) go to egress instead, and the sandbox gets a stand-in |
| `SPOTLIGHT_SANDBOX_PASS` | unset | names of the host's own variables to pass into sandboxes |
| `SPOTLIGHT_RUN_TIMEOUT` | `6h` | a sandbox running longer is stopped and destroyed |
| `SPOTLIGHT_ANSWER_WAIT` | `5m` | how long a sandbox whose run asked a person stays up for the answer, still holding its slot, before the run is parked; `0` parks at once |
| `SPOTLIGHT_SANDBOX_NETWORK`, `SPOTLIGHT_SANDBOX_HOSTS`, `SPOTLIGHT_SANDBOX_URL` | unset | the network egress joins beside each sandbox's own, egress's extra hosts entries, and the control plane's address as egress reaches it |
| `SPOTLIGHT_EGRESS_ALLOW` | unset: any public host | the hosts sandboxes may reach, comma-separated: `api.anthropic.com`, or `*.acme.internal` for its subdomains. A host that resolves to a private address is reached only when an entry names it. Secrets are worn only toward hosts the list admits; the control plane and its storage are always reached |
| `SPOTLIGHT_EGRESS_READS` | unset: none | the AWS Secrets Manager secrets egress may read as the host, comma-separated: names or ARNs, or prefixes ending in `*` |
| `SPOTLIGHT_EGRESS_IMAGE` | `ghcr.io/usespotlightai/spotlight-runner:<release>` | the image egress runs from: Spotlight's own, never a repository's |
| `SPOTLIGHT_EGRESS_ENV`, `SPOTLIGHT_EGRESS_PASS` | `egress.env` beside `host.env`, unset | variables only egress gets, such as `AWS_REGION` or credentials for reading AWS Secrets Manager as the host |
| `SPOTLIGHT_EGRESS_TRUST` | unset | a PEM file of authorities egress trusts upstream, for private hosts behind an internal CA; sandboxes never trust them |
| `SPOTLIGHT_STATE` | `/var/lib/spotlight-host` or `~/.spotlight/host` | the host's id and its git mirrors |

The host keeps a bare mirror of each repository it has checked out and mounts
it read-only into sandboxes: a run's clone borrows from it and dissociates, so
a kept workspace restores on any host; a change stack check leans on it
directly. It destroys every sandbox after success, failure, a stop, a timeout,
and on start-up those a crashed host left behind. It reports its capacity,
what it runs and the harnesses its images hold, which is what the Runners page
shows.

Before each run it pulls the run's image again, which costs one manifest request
when nothing moved, starts the sandbox from the image it just pulled, and records
that digest on the run. A tag pushed again reaches the next run with no restart.
When the digest changes, it looks inside the image again and fails a run whose
harness the new image dropped. A pull that fails falls back to the copy it has;
only with no copy at all does the run fail. An image named by digest, or built on
the host and never pushed, is not pulled.

### Egress

A sandbox's only way out is `spotlight egress`, a container the host starts
beside it for that run alone and destroys with it. The sandbox sits on an
internal network of its own, and egress on that network and the host's. Every
client in the sandbox is pointed at it (`HTTPS_PROXY`, `HTTP_PROXY`), and one
that ignores the proxy has no route out at all.

- **One sandbox, one egress.** The proxy address sandboxes get carries a
  credential for that run alone; an egress answers no other sandbox.
- **Secrets never enter the sandbox.** A secret an MCP server's `env` names
  (`secret.LINEAR_API_KEY`) reaches the server as the stand-in
  `spotlight-egress:LINEAR_API_KEY`. The run records which secrets it wears;
  egress redeems them with a credential the host was handed for egress alone,
  and wears each one only on requests to the hosts it is bound to whose bound
  header, or query parameter, holds its stand-in, alone or after the binding's
  prefix. The rest of the query keeps its order and encoding. A header or query
  parameter holding a stand-in egress doesn't hold is taken off, and a request
  egress could not pass on is answered without its address. Where the host
  echoes a secret back, in a redirect, a link or a text answer, egress hands the
  sandbox the stand-in instead. A request to any other
  host carries nothing egress added. The host bounds this: egress wears nothing toward a host
  `SPOTLIGHT_EGRESS_ALLOW` leaves out, reads only the Secrets Manager secrets
  `SPOTLIGHT_EGRESS_READS` lists, and never wears two secrets in one header or
  query parameter.
- **Values Spotlight keeps** come sealed to a key egress made for the run
  (X25519, HKDF-SHA256, AES-256-GCM, bound to the run and the secret). **Values
  in AWS Secrets Manager** are read by egress itself, with the host's identity
  (`SPOTLIGHT_EGRESS_ENV`), so the control plane never sees them. Both live in
  egress's memory for the run, and the run's grants end with it.
- **HTTPS.** Egress mints a certificate authority for each run, keeps its key
  in memory, and constrains it to the hosts it wears secrets or the host's
  keys toward. The runner adds it to the image's own system bundles (Debian,
  RHEL and Alpine paths) and to `/etc/spotlight/egress/bundle.pem`, which
  `SSL_CERT_FILE`, `REQUESTS_CA_BUNDLE`, `CURL_CA_BUNDLE` and `GIT_SSL_CAINFO`
  name; `NODE_EXTRA_CA_CERTS` names the authority alone. Egress opens only
  traffic to those hosts; the rest passes through untouched, by the host named
  in the `CONNECT`. A client that pins its own certificates fails against such
  a host.
- **Refused:** hosts outside `SPOTLIGHT_EGRESS_ALLOW`; private addresses
  (RFC 1918, unique-local IPv6, `100.64.0.0/10`) unless an entry names the
  host; and, whatever the list says, loopback and link-local addresses, so a
  sandbox never reaches instance metadata and the host's own identity.
- **Push pools.** A runner a push pool provisions has no egress, so a run that
  wears secrets is never offered to one; it waits for a host.
- **Harness keys stay with the host.** A host keeps the harness keys it
  knows out of the sandbox and hands them to egress: `ANTHROPIC_API_KEY`
  (`x-api-key`) and `CLAUDE_CODE_OAUTH_TOKEN` (`authorization: Bearer`) toward
  `api.anthropic.com`, `OPENAI_API_KEY` and `CODEX_API_KEY`
  (`authorization: Bearer`) toward `api.openai.com`. Where each key may go is
  the host's own table, never the control plane's to say. The sandbox gets
  `spotlight-egress:NAME`, and egress wears a key only in place of that exact
  stand-in, toward a host the allow-list admits; a run's own secrets are
  never worn toward a host the host holds a key for. The image probe that
  lists a harness's models runs behind an egress too. `CURSOR_API_KEY` still
  enters the sandbox, and logins that refresh their tokens (Codex with
  ChatGPT, Claude in a browser) are not worn; use an API key or
  `claude setup-token`.
- **Not yet covered.** Egress cannot itself sit behind a proxy.

Harnesses live only in the runner image (`.docker/runner/Dockerfile`, built
from this repository, with `CLAUDE_CODE_VERSION`, `CLAUDE_AGENT_ACP_VERSION`
and `CODEX_ACP_VERSION` as build arguments).

Tagging triggers `release.yml`, which starts the `infrastructure` repo's build:
service images and the runner image, plus the `spotlight` binaries
attached to this repository's release for the tag.

## Runner environments

A line's repository may name the image its runs happen in and how its checkout
is made ready:

```hcl
resource "spotlight_line" "delivery" {
  repository {
    name  = "acme/api"
    image = "ghcr.io/acme/api-runner:main"
    setup = "go mod download"
  }
  # stations …
}
```

- **`image`** is where every station of the line runs, and its change stack
  checks too. Name none and runs use the host's default image. A line's
  repositories name one image or none, and a host serves an image only when its
  `SPOTLIGHT_RUNNER_IMAGE` admits it. The image digest is the only harness pin:
  build the release you want into the image.
- **`setup`** runs in the checkout, as the agent, after the checkout is on the
  run's branch and before the agent starts. A change stack check runs it again
  wherever a layer changes a lockfile. It should be quick on an image that
  already holds the dependencies, e.g. `npm install` against a nearly matching
  `node_modules`. A line whose station checks its layers needs a `setup` on
  every repository. When a repository has one, a workspace archive leaves out
  what the repository ignores, since the image and `setup` lay it down again.

An image is built `FROM` the runner image, in the user's own CI:

- The runner runs as root and is the entrypoint; the agent runs as `agent`
  (uid 2000).
- The workspace is `/workspace`, the same for every run and check. Each
  repository is checked out at `/workspace/<name>` (the repository's name
  without its owner), so an image can bake a checkout with its dependencies
  there; the run then only fetches and switches branches.
- `spotlight` and the harnesses are on `PATH`, and the entrypoint is
  `spotlight runner`; `spotlight runner harnesses '[]'` prints the
  runner's release and what the image holds. A host refuses an image whose
  runner is older than the control plane needs, and the Runners page says so.
- Build as `agent`, or hand what you bake to `agent`: the runner gives the
  workspace to `agent` before the agent starts, touching only what isn't
  already its.

```dockerfile
FROM ghcr.io/usespotlightai/spotlight-runner:20261002-01
USER agent
RUN git clone https://github.com/acme/web /workspace/web
WORKDIR /workspace/web
RUN npm ci
USER root
```

```dockerfile
FROM ghcr.io/usespotlightai/spotlight-runner:20261002-01
RUN apt-get update && apt-get install -y --no-install-recommends python3-venv \
    && rm -rf /var/lib/apt/lists/*
USER agent
RUN git clone https://github.com/acme/models /workspace/models \
    && python3 -m venv /workspace/models/.venv \
    && /workspace/models/.venv/bin/pip install -r /workspace/models/requirements.txt
USER root
```

```dockerfile
FROM golang:1.26-bookworm AS go
FROM ghcr.io/usespotlightai/spotlight-runner:20261002-01
COPY --from=go /usr/local/go /usr/local/go
ENV PATH=/usr/local/go/bin:$PATH GOPATH=/home/agent/go
USER agent
RUN git clone https://github.com/acme/api /workspace/api \
    && cd /workspace/api && go mod download && go build ./...
USER root
```

```dockerfile
FROM ghcr.io/usespotlightai/spotlight-runner:20261002-01
USER agent
RUN curl -fsSL https://sh.rustup.rs | sh -s -- -y --profile minimal
ENV PATH=/home/agent/.cargo/bin:$PATH CARGO_TARGET_DIR=/home/agent/target
RUN git clone https://github.com/acme/engine /workspace/engine \
    && cd /workspace/engine && cargo fetch && cargo build
USER root
```

`CARGO_TARGET_DIR` keeps build output outside the checkout, so it survives the
checkout being replaced by a restored workspace. A private repository is cloned
in the image with the build's own credentials, never Spotlight's. Images can
also pre-install the MCP servers a harness profile names, so `npx` stops fetching
them on every run. A push pool's provision call carries the `image` to start
(`null` for its default).

## Harness profiles

A `spotlight_harness_profile` (`/api/resources/teams/{teamId}/harness-profiles`)
says once what a team's agents may do, and a station names it with `profile`.
Claude Code, Codex and Cursor each get it in their own terms.

```json
{
  "key": "careful",
  "permissions": {
    "allow": ["read", "edit", "execute(npm test *)"],
    "ask": ["execute(git push *)"],
    "deny": ["read(.env)"]
  },
  "mcpServers": [
    {
      "name": "linear",
      "command": "npx",
      "args": ["-y", "linear-mcp"],
      "env": { "LINEAR_API_KEY": "secret.LINEAR_API_KEY" }
    }
  ],
  "native": {
    "claude-code": { "includeCoAuthoredBy": false },
    "codex": "model_verbosity = \"low\"\n",
    "cursor": { "editor": { "vimMode": true } }
  }
}
```

- **Permissions** are `read`, `edit` or `execute`, alone or with a pattern.
  A rule with a pattern outranks a bare one; anything unlisted is allowed.
  Where a harness can't say a rule, the resource's `warnings` name the
  approximation, e.g. Cursor has no ask rules, and Codex can't restrict reads.
- **Ask** becomes a Spotlight approval. When the harness asks about a kind of
  action an `ask` rule covers, its ACP permission request goes to the inbox,
  the run lets the task go, and once a person approves, the next run resumes
  the same session and the same call goes through once. Anything else the
  harness asks about, including tools outside read, edit and execute such as
  web fetches, is allowed.
- **Native** settings pass through as the harness reads them: Claude Code
  settings JSON, Codex `config.toml` text, Cursor CLI config JSON. Where they
  set a key the permissions also write, the native value wins, with a warning.
- **MCP servers** run over stdio, written out in each harness's own format.
  An `env` value is either plain text, stored and shown as written, or a
  reference to a workspace secret (`secret.LINEAR_API_KEY`). A reference must
  name a secret the workspace holds, keeps that secret from being deleted, and
  reaches the server only as a stand-in: egress wears the value on the
  server's requests to the hosts the secret is bound to (see
  [Egress](#egress)).
- **Where they're written.** The common layer lands at user level, under the
  run's state directory: `claude/settings.json` (`CLAUDE_CONFIG_DIR`),
  `codex/config.toml` and `codex/rules/spotlight.rules` (`CODEX_HOME`),
  `cursor/cli-config.json` and `cursor/mcp.json` (`CURSOR_CONFIG_DIR`). A
  repository's own `.claude/settings.json`, `AGENTS.md` and the like still
  apply on top. What must hold goes where the repository can't reach: Claude
  Code's ask and deny rules as managed settings in the ACP session. Codex's
  approvals come to Spotlight through codex-acp's `read-only` mode, which sets
  approval policy and a workspace-write sandbox on every turn; its model and
  effort go in `CODEX_CONFIG`, which codex-acp merges into Codex's `-c`
  override layer. Cursor has no such layer.

**Harness permissions are guardrails, not the security boundary.** An agent can
still find a way around its own harness's rules, and a repository can loosen
what isn't enforced. What contains an agent is the sandbox it runs in and
egress, the only way out of it.

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
| `SPOTLIGHT_SECRETS_KEY` | wraps each workspace's data key, which seals secrets and host connection tokens; losing it means setting every secret again and reconnecting each integration (`openssl rand -base64 32`); not needed with `SECRETS_KMS_KEY_ID` |
| `SECRETS_KMS_KEY_ID` | an AWS KMS key that wraps workspace data keys instead of `SPOTLIGHT_SECRETS_KEY` |
| `SECRETS_AWS_SECRETS_MANAGER` | `true` lets a secret be read from AWS Secrets Manager when it is worn |
| `OUTBOUND_ALLOWED_HOSTS` | comma-separated hosts integrations and their tools may call; empty allows none (`compose.yml` defaults it to `slack.com`) |
| `OAUTH_CLIENTS` | shared OAuth2 apps as JSON, e.g. `{"slack":{"id":"…","secret":"…"}}` |
| `SPOTLIGHT_CATALOG_URL`, `SPOTLIGHT_CATALOG_TOKEN` | where catalog tools are called, and the token sent with each call; the catalog host is always allowed, whatever `OUTBOUND_ALLOWED_HOSTS` says (defaults to `https://catalog.usespotlight.ai`) |

### Attachments and workspace archives

Browsers upload straight to S3 through presigned URLs (15 minutes) under
`pending/<workspace>/<id>`. A file joins a task only once its id is sent with
one; after the task or chat has accepted and saved the message, the object is
copied under `workspaces/<workspace>/attachments/` and the pending copy
dropped. If that save fails afterwards, the kept copy stays: nothing removes
attachments under `workspaces/`, which is the cheaper side to err on. In
development MinIO serves the bucket under its own hostname, so addressing
matches AWS.

A runner keeps its task's workspace, its checkout and the harness's conversation,
in the same bucket, under `workspaces/<id>/archives/`, so a later run of the
task restores it in a fresh sandbox. They upload and fetch through presigned
URLs signed for `S3_RUNNER_ENDPOINT`, or `S3_ENDPOINT` when it is unset. An
archive may be 2 GiB packed; one a later run will not restore is removed an
hour after a newer one is kept, a week after its task finishes or its chat
leaves its conversation, and at once when its task or chat is deleted.

| Variable | Development | Production |
|---|---|---|
| `S3_BUCKET` | `files` | bucket name |
| `S3_REGION` | `us-east-1` | bucket region |
| `S3_ENDPOINT` | `http://storage:9000` | unset |
| `S3_FORCE_PATH_STYLE` | `true` | unset |
| `S3_PUBLIC_ENDPOINT` | `https://dev.usespotlight.ai` | unset, or a CDN |
| `S3_PUBLIC_FORCE_PATH_STYLE` | unset | unset |
| `S3_RUNNER_ENDPOINT` | unset | unset, or where runners reach the bucket when `S3_ENDPOINT` is private |
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
3. A lifecycle rule expiring objects under `pending/` after a day. Nothing
   under `workspaces/` should expire: Spotlight removes archives itself, kept
   attachments are never removed, and expiring an archive loses a task's
   conversation.

The key pair needs only `s3:PutObject`, `s3:GetObject` and `s3:DeleteObject` on
`arn:aws:s3:::<bucket>/pending/*` and `arn:aws:s3:::<bucket>/workspaces/*`.

### Mail

Invitations (Settings > Members) are emailed links. The token is stored
hashed, expires after 14 days, and re-inviting replaces it.

| Variable | Development | Production |
|---|---|---|
| `SMTP_URL` | `smtp://mail:1025` | e.g. `smtps://user:pass@smtp.example.com:465` |
| `MAIL_FROM` | `Spotlight <noreply@dev.usespotlight.ai>` | a permitted sender |

With `SMTP_URL` unset, messages are logged instead of sent.
