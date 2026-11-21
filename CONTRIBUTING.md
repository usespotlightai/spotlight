# Contributing to Spotlight

## Repository

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
dev pool, which starts sandboxes from the `spotlight-runner:dev-harnesses` image
on the compose network. That image is `spotlight-runner:dev` with the example
harness images of `data-plane/host/internal/harnesses/dockerfiles/` built on top of it, one after the
other. It reloads on edits to `data-plane/`; the images do not, so rebuild them
with `docker compose build runner runner-claude-code runner-codex runner-cursor runner-harnesses`
after changing the runner or agent commands.

## Schema changes

Edit the schema of the context you change, under
`control-plane/src/contexts/<context>/infrastructure/persistence/drizzle/schemas/`,
then:

```bash
docker compose exec -T control-plane npm run db:generate -- --name=describe_the_change
docker compose up -d
```

Migrations are generated, never hand-written. Auth tables come from the
better-auth config: run `npm run auth:generate` first.

## Naming

- Identifiers, API fields, routes, DB columns, event names, environment
  variables, Terraform attributes and CLI flags use the common industry term,
  also when it is technical: inject, lease, reconcile, status, version conflict.
- ASD-STE100 applies to comments, messages, UI text and docs prose. It does not
  apply to identifiers.
- Use one name for one concept. Before you name a new concept, read the
  [docs glossary](https://docs.usespotlight.ai/docs/reference/glossary) and the
  developer glossary below. If a name exists, use it.
- Do not use a preposition, a past tense or a phrase as a name. A command is an
  imperative verb, such as `renew`, `cancel` or `processDue`.

### Developer glossary

These terms are for the code only. The docs glossary has the terms that users
see.

| Term | Meaning |
|---|---|
| Admin token | The token for the whole deployment, `SPOTLIGHT_ADMIN_TOKEN`, that gives access to `/api/admin` (`AdminOnly`, `AdminGuard`). It is not the workspace admin role. |
| Change actor | The person, token or Spotlight that made a configuration change in one workspace (`ChangeActor`). A change made with the admin token shows as Spotlight. |
| Error kind | The class of a domain or application error (`ErrorKind`), such as `invalid` or `conflict`. The HTTP filters map it to a status code. |
| Event delivery | One outbox event for one subscriber (`event_delivery`). A webhook delivery is one incoming webhook request; its body is the payload. |
| Hand-over | Terraform removes `valueWoVersion` from a secret. Spotlight keeps the stored value, and from then on a person sets it (`valueChange: handed-over` in the change history). |
| Job loop | The loop that processes the due pending jobs of one kind (`JobLoop`, `PendingJobsPort.processDue`). |
| Ledger | A table gateway that is not an aggregate repository (`*.ledger.ts`). |
| Metered call | One usage row for each catalog tool call (`MeteredCall`). |
| Pending job | A row that a job loop must process, with its attempts and next attempt time (`job_attempts`, `job_due_at`). |
| Plan term | A plan and the time it ends, if it ends (`PlanTerm`). The free plan never ends. |
| Processed event | A record that a subscriber processed one event, so it does not process the event again (`processed_event`). |
| Provisioning | The retry state when Spotlight asks a push pool for a runner (`provision_attempts`, `next_provision_attempt_at`). |
| Recipient | The public key that Spotlight seals a run's secrets to: one key for each run in an egress sidecar, one key for each process in a shared egress. |
| Refused run | A run that Spotlight creates and ends failed before it starts, because the station needs something that is missing (`RefusalReason`, such as `SecretAwaitingValue`). A reply to its inbox item orders a new run. Compare run not started. |
| Resume key | The key of a working copy archive (`task-<id>` or `chat-<id>`). A run restores the archive of its resume key. |
| Run not started | A task that has no run, because Spotlight cannot start the station's harness (`RunNotStarted`). Try again or a message starts it. Compare refused run. |
| Tombstone | A row that Spotlight keeps after it deletes data, so that it does not restore the data (`deleted_*` tables). |
| Value origin | Where a secret's value comes from (`SecretValueOrigin`): `awaiting` (no value yet), `spotlight` (a person set it, or Terraform handed it over) or `terraform` (`valueWoVersion` is set). |
| Worker | An interval poller in the control plane (`*.worker.ts`). It runs no Spotlight runs. A runner runs Spotlight runs. |
| Workspace directory | Every workspace of the deployment, not scoped to a viewer (`WorkspaceDirectoryPort`). |
| Workspace plan | The plan term stored for one workspace (`WorkspacePlan`). A workspace without a workspace plan has the free plan. |

## Releases

The runner image (`.docker/runner/Dockerfile`) holds no harness. `spotlight host init`
builds an image `FROM` it on the host with the harnesses the person picks.
`data-plane/host/internal/harnesses/dockerfiles/` has the Dockerfile for each harness, with
`BASE`, `CLAUDE_CODE_VERSION`, `CLAUDE_AGENT_ACP_VERSION`,
`CODEX_ACP_VERSION` and `OPENCODE_VERSION` as build arguments. No image with a harness is published.

Releases use semantic versioning (`v0.4.1`) and come from
[release-please](https://github.com/googleapis/release-please) on `develop`:

- **Pull request titles:** pull requests are squash-merged, so the title
  becomes the commit. It is a Conventional Commit with the Linear issue as the
  scope, as in `feat(SPO-123): Add the judge to stations`, and the **Pull
  request title** check enforces it. `feat` and `fix` make a release; `docs`,
  `chore`, `ci`, `test`, `refactor` and `build` do not. `feat!` marks a
  breaking change.
- **Release pull request:** after each merge to `develop`, release-please
  updates one open pull request with the next version and its `CHANGELOG.md`
  entries.
- **Publishing:** merging the release pull request tags the commit and creates
  a draft release. When CI passes on it, `release.yml` starts the
  `infrastructure` repo's build: service images and the runner image tagged
  with the version, plus the `spotlight` binaries, which it uploads to the draft
  before it publishes it.
- **Staging:** every build of `develop` is a commit tag plus `canary`, never a
  release. Its binaries are in the `canary` prerelease.

## Running Spotlight

How to run Spotlight yourself is in the docs ([usespotlightai/docs](https://github.com/usespotlightai/docs)):

- **Self-hosted Spotlight settings** (`reference/self-hosted-settings`): the control plane's environment variables, the S3 bucket and mail.
- **Host settings**, **Egress** and **Inside a sandbox** (`reference/hosts/`): hosts, runners and how a sandbox reaches the outside.
- **Run a line in your own image** (`hosts/run-a-line-in-your-own-image`): runner images.
- **Harness profile** (`reference/terraform/harness-profile`): what a team's agents may do.
