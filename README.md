![Spotlight: Agents write the code. Build a software factory you actually own.](.github/assets/og.png)

<div align="center">
  <h3>
    <a href="https://usespotlight.ai"><strong>Website</strong></a> ·
    <a href="https://app.usespotlight.ai"><strong>Sign in</strong></a> ·
    <a href="CONTRIBUTING.md"><strong>Contributing</strong></a>
  </h3>
</div>

Spotlight turns your team's process into a line of stations, each run by its own agent. Tasks move from station to station, people step in where a decision is theirs, and every change to how the line works is measured against the runs it affects.

## ✨ What it does

- **A line of stations.** Each station runs its own agent, prompt, tools and model. Agents ask before they guess, and nothing starts until a person accepts the work.
- **Any harness, any model.** Claude Code, Codex or Cursor, chosen per station.
- **Runs on your machines.** Every run gets a fresh sandbox on your servers, in Daytona or E2B, or in our cloud.
- **Secrets stay out of the agent.** They are added to requests only as they leave the sandbox.
- **Configuration as code.** Lines, stations and teams are Terraform, reviewed in pull requests.
- **Measured, then improved.** Replay a config change on past tasks before it ships, or let Spotlight search for a better one.

## 🧱 What's in this repository

| Path | What |
|---|---|
| `control-plane/` | NestJS API on Postgres |
| `web/` | React app (Vite) |
| `data-plane/` | Go: one `spotlight` binary that runs as a host, a runner in a sandbox, or the commands agents talk back with |

## 🚀 Run it locally

Needs [Docker](https://docs.docker.com/get-started/get-docker/) and [mkcert](https://github.com/FiloSottile/mkcert).

```bash
echo "127.0.0.1 app.dev.usespotlight.ai files.dev.usespotlight.ai" | sudo tee -a /etc/hosts
mkcert -install
(cd .docker/traefik/certs && mkcert "*.dev.usespotlight.ai")
cp .env.example .env    # fill in, see CONTRIBUTING.md
docker compose up -d
```

The app is then at https://app.dev.usespotlight.ai. [CONTRIBUTING.md](CONTRIBUTING.md) covers the full setup.
