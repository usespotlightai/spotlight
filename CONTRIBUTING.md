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
| Assist session | One run that Spotlight starts on behalf of a context to get one JSON result, such as a verdict or a drafted stack (`AssistSession`). The context orders it with a purpose, a session key and a base run, and reads its state: `waiting`, `submitted` or `failed`. |
| Base run | The run an assist session is based on (`basedOnRun`). The session takes its harness, model, effort, placement and working copy. It must be a run of the same workspace. |
| Change actor | The person, token or Spotlight that made a configuration change in one workspace (`ChangeActor`). A change made with the admin token shows as Spotlight. |
| Snapshot removal | The snapshot of a removed working copy archive, queued until a host of its store deletes it (`snapshot_removal`, `SnapshotRemovalsPort`). Spotlight cannot reach the store, so a host whose pool or trust names the same store lists the removals (`GET /api/hosts/snapshot-removals`), has its working copy hook delete each snapshot, and forgets the removal. |
| Delivery lane | One of the two sets of event deliveries that the outbox worker delivers apart from each other (`DeliveryLane`, `DELIVERY_LANES`): `contexts` for the subscribers of the contexts, and `sinks` for the event sinks. Each lane is a filter on `event_delivery`. The worker ticks each lane on its own, so a slow or failing sink does not stop the subscribers of the contexts. |
| Error kind | The class of a domain or application error (`ErrorKind`), such as `invalid` or `conflict`. The HTTP filters map it to a status code. |
| Event delivery | One outbox record for one subscriber (`event_delivery`). A webhook delivery is one incoming webhook request; its body is the payload. |
| Event sink | A subscriber of the platform that sends integration events out of Spotlight, such as the event webhook (`EventSubscribers.registerSink`). It hears integration events by context, and its deliveries go in the sinks lane (`DeliveryLane`), apart from the contexts lane of the subscribers of the contexts, so a slow receiver does not hold them up. |
| Event webhook | The one URL of the deployment, `SPOTLIGHT_EVENT_WEBHOOK_URL`, that gets the integration events of every workspace as signed Standard Webhooks calls (`EventWebhook`, the subscriber `platform.send-event-webhook`). `SPOTLIGHT_EVENT_WEBHOOK_KINDS` limits it to kinds in full or to contexts (`EventSubscribers.registerSink`). A failed event delivery becomes a dead letter after its last attempt (`EVENT_WEBHOOK_RETRY`), and `POST /api/admin/event-webhook/redeliver` queues it again. While the URL is set, the outbox keeps the dead letters of the kinds it still sends, and their events, until they are delivered; once the URL is unset or the kinds no longer name them, retention deletes them after 7 days. It is not a hook, which a team sets (`spotlight_hook`), and not a webhook delivery, which comes in. |
| Hand-over | Terraform removes `valueWoVersion` from a secret. Spotlight keeps the stored value, and from then on a person sets it (`valueChange: handed-over` in the change history). |
| Hearing | The event kinds that one subscriber hears (`Hearing`): the kinds it names in full, and, for an event sink only, each integration event kind that starts with one of its prefixes. A prefix is a context, such as `identity.`, or the empty prefix, which matches every integration event. `EventSubscribers.hears` and the outbox queries (`heardDeliveries`) read the same hearings, so an instance claims only the deliveries that it can handle. |
| Job loop | The loop that processes the due pending jobs of one kind (`JobLoop`, `PendingJobsPort.processDue`). |
| Ledger | A table gateway that is not an aggregate repository (`*.ledger.ts`). |
| Outbox record | The id and the record time of one event in the outbox (`event_outbox`, `OutboxRecord`). A subscriber gets it with the event; the event webhook sends the id as `webhook-id`. |
| Pending job | A row that a job loop must process, with its attempts and next attempt time (`job_attempts`, `job_due_at`). |
| Platform pool | The push pool that Spotlight adds to each workspace when the deployment sets `SPOTLIGHT_PLATFORM_POOL_URL` (`runner_pool.platform`). The deployment gives its provision URL and secret, so the row keeps neither. It takes only work that no other pool or trust of the workspace fits, and the operator can disable it for one workspace. Terraform does not see or change it. Compare the platform egress. |
| Processed event | A record that a subscriber processed one event, so it does not process the event again (`processed_event`). |
| Provisioning | The retry state when Spotlight asks a push pool for a runner (`provision_attempts`, `next_provision_attempt_at`). |
| Purpose | What an assist session is for, named `<context>.<name>` by the context that orders it, such as `insights.judge` (`AssistPurpose`). |
| Recipient | The public key that Spotlight seals a run's secrets to: one key for each run in an egress sidecar, one key for each process in a shared egress. |
| Refused run | A run that Spotlight creates and ends failed before it starts, because the station needs something that is missing (`RefusalReason`, such as `SecretAwaitingValue`). A reply to its inbox item orders a new run. Compare run not started. |
| Resume key | The key of a working copy archive (`task-<id>` or `chat-<id>`). A run restores the archive of its resume key. |
| Run not started | A task that has no run, because Spotlight cannot start the station's harness (`RunNotStarted`). Try again or a message starts it. Compare refused run. |
| Session key | The name of one assist session among the sessions of a workspace and purpose (`AssistSessionKey`). The same key reports the same session; a new key orders a new session. |
| Signing secret | A Standard Webhooks secret, `whsec_` followed by 24 to 64 base64-encoded random bytes, that signs outgoing calls (`SigningSecret`, `SIGNING_SECRET_RULE`). Hooks, push pools, the platform pool and the event webhook use it. A push pool calls it its provision secret (`provision.secret`, and `EncryptedProvisionSecret` when it is stored). `SigningSecret.of` refuses a bad secret with `InvalidSigningSecretError`, and the definition schemas show its reason at the field (`madeBy`). A context that names the field in its own error checks `SigningSecret.isWellFormed` first, as a hook does at `signing.secret`. |
| Tombstone | A row that Spotlight keeps after it deletes data, so that it does not restore the data (`deleted_*` tables). |
| Value origin | Where a secret's value comes from (`SecretValueOrigin`): `awaiting` (no value yet), `spotlight` (a person set it, or Terraform handed it over) or `terraform` (`valueWoVersion` is set). |
| Waiting job | A pending job that waits for something outside it, such as an assist session (`waitJob`, `waiting_since`). Waiting costs no attempt. The job loop looks again after `WAIT_MS`, and a job that waits longer than `MAX_WAIT_MS` (24 h) is exhausted. |
| Working copy hook | The operator's program that a host runs to keep working copies in the store of its pool or trust (`working-copy-hook`, `workingcopyhook`). The host runs `<hook> <event>` with one JSON request: `check`, `open`, `snapshot`, `close` or `remove`. The hook holds what the store needs to be reached; it sees no credential of Spotlight. |
| Working copy store | Where the hosts of a pull pool or trust keep the working copies of runs (`workingCopies: { store, base }`, `WorkingCopyStore`, Terraform `working_copies`). With none, the runner archives a tar in Spotlight's storage. With one, the host opens each sandbox's workspace through its working copy hook, and each working copy archive is a snapshot that the host makes (`StoreSnapshot`, named `spotlight-<archive id>`). Spotlight does not read the store's name: an archive belongs to its store, not to a pool, so any pool or trust with the same store restores it. A run that starts no session of its own starts from the store's current `base` when the last snapshot descends from another base. |
| Worker | An interval poller in the control plane (`*.worker.ts`). It runs no Spotlight runs. A runner runs Spotlight runs. |
| Workspace directory | Every workspace of the deployment, not scoped to a viewer (`WorkspaceDirectoryPort`). |

## Releases

The runner image (`.docker/runner/Dockerfile`) holds no harness. `spotlight host init`
builds an image `FROM` it on the host with the harnesses the person picks.
`data-plane/host/internal/harnesses/dockerfiles/` has the Dockerfile for each harness, with
`BASE`, `CLAUDE_CODE_VERSION`, `CLAUDE_AGENT_ACP_VERSION`,
`CODEX_ACP_VERSION` and `OPENCODE_VERSION` as build arguments. No image with a harness is published.

Releases use semantic versioning (`v0.4.1`) and come from
[release-please](https://github.com/googleapis/release-please) on `develop`:

- **Pull request titles:** pull requests are squash-merged, so the title
  becomes the commit. It is a Conventional Commit, as in
  `feat: add the judge to stations`, and the **Pull request title** check
  enforces it. The description says which issue it closes, as in `Fixes #123`.
  When the release is published, `project-status.yml` moves that issue to
  Released on the Spotlight project. `feat` and `fix` make a release; `docs`,
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
