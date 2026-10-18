![Spotlight: The models are rented. But the factory is yours to build.](.github/assets/og.png)

<div align="center">
  <h3>
    <a href="https://app.usespotlight.ai"><strong>Spotlight Cloud</strong></a> ·
    <a href="https://docs.usespotlight.ai"><strong>Docs</strong></a> ·
    <a href="https://docs.usespotlight.ai/docs/getting-started/start-guide"><strong>Getting Started</strong></a>
  </h3>
</div>
<div align="center">
  <a href="https://github.com/usespotlightai/spotlight/issues/new?labels=bug"><strong>Report Bug</strong></a> ·
  <a href="https://github.com/usespotlightai/spotlight/discussions/new?category=ideas"><strong>Feature Request</strong></a> ·
  <a href="https://github.com/usespotlightai/spotlight/releases"><strong>Changelog</strong></a> ·
  <a href="https://docs.usespotlight.ai/docs/reference/roadmap"><strong>Roadmap</strong></a>
</div>
<br/>

<p align="center">
  <a href="LICENSE"><img alt="License: Apache 2.0" src="https://img.shields.io/badge/license-Apache%202.0-blue"></a>
  <a href="https://github.com/usespotlightai/spotlight/actions/workflows/release.yml"><img alt="Release build" src="https://github.com/usespotlightai/spotlight/actions/workflows/release.yml/badge.svg"></a>
  <a href="https://docs.usespotlight.ai"><img alt="Docs" src="https://img.shields.io/badge/docs-docs.usespotlight.ai-black"></a>
  <a href="https://github.com/usespotlightai/terraform-provider-spotlight"><img alt="Terraform provider" src="https://img.shields.io/badge/terraform-provider-7B42BC?logo=terraform&logoColor=white"></a>
  <a href="https://github.com/usespotlightai/spotlight/discussions"><img alt="GitHub Discussions" src="https://img.shields.io/badge/github-discussions-181717?logo=github"></a>
</p>

Spotlight turns your team's process into a line of stations, each run by its own agent. Tasks move from station to station, people step in where a decision is theirs, and every change to how the line works is measured against the runs it affects.

## Core Features

- **A line of stations.** Model how your team works as lines, such as Delivery or Incidents, made of stations like Triage, Spec and Build. Each station runs its own agent with its own prompt, tools, skills and model. A finished run either asks a person in the inbox or hands the task to the next station, so nothing moves on by itself.
- **People decide, agents ask.** Your team's agent plans work with you in a chat and proposes tasks, and nothing starts until a person accepts them. Agents ask before they guess, and a tool call that needs approval waits in the inbox. Answer in Spotlight or in the Slack thread.
- **Any harness, any model.** Run Claude Code, Codex, Cursor or OpenCode, and pick the model and effort per station. A harness profile states once what a team's agents may read, edit and run, and which MCP servers they get. Spotlight writes it out in each harness's own settings.
- **Runs on your machines.** Every run gets a fresh sandbox, destroyed when it ends. Install the `spotlight` host on any machine with Docker or Podman, provision sandboxes in Daytona or E2B, or use our cloud. Each line can run in its own image, with your toolchain and dependencies baked in, and a task's workspace and conversation follow it from run to run.
- **Secrets stay out of the agent.** A sandbox reaches the outside only through an egress proxy started for that run. Secrets never enter the sandbox: egress injects them into requests as they leave, and only for the hosts that each secret is bound to. Secrets live in your workspace's vault or in AWS Secrets Manager.
- **Changes you can review.** Spotlight splits each change into reviewable layers and records the agent's reasoning beside them. It can also review your team's pull requests on GitHub when asked.
- **Configuration as code.** Lines, stations, teams, integrations and harness profiles are Terraform resources, reviewed in pull requests like any other code. A setup chat drafts your team's first configuration and opens the pull request.
- **Measured, then improved.** Insights track every config change against runs, rework and cost. Replay a change on past tasks before it ships, scored by the station's checks and judge. Or let Spotlight search for a better config: it tests what it finds on tasks the search never saw, and opens a pull request for the one you pick.

## Contributing

Your contributions are welcome!

- Vote on ideas in [GitHub Discussions](https://github.com/usespotlightai/spotlight/discussions).
- Raise and comment on [Issues](https://github.com/usespotlightai/spotlight/issues).
- Open a pull request. See [CONTRIBUTING.md](CONTRIBUTING.md) for how to set up a development environment.

## License

Spotlight is licensed under the [Apache License 2.0](LICENSE).
