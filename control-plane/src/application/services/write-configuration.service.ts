import type {
  OpenedPullRequestDto,
  PullRequestPort,
} from '@application/ports/pull-request.port';
import type { Team } from '@domain/aggregates/team.aggregate';
import type { Workspace } from '@domain/aggregates/workspace.aggregate';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
import type { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import { Repository } from '@domain/value-objects/repository.vo';

export interface Writing {
  readonly branch: string;
  readonly title: string;
  readonly body: string;
  readonly files: readonly ConfigurationFile[];
}

/**
 * Writes configuration into the repository that holds it, as a pull request.
 *
 * Everything Spotlight writes goes this way — the file that opens a
 * workspace, the files for the tools a team chose, a line changed on the
 * board — so there is one answer to where configuration is written and one
 * place it can go wrong.
 */
export class WriteConfiguration {
  constructor(
    private readonly configurations: TeamConfigurationRepository,
    private readonly pullRequests: PullRequestPort,
  ) {}

  /** Null where there is nowhere to write it yet. */
  async write(
    workspace: Workspace,
    team: Team,
    writing: Writing,
  ): Promise<OpenedPullRequestDto | null> {
    const installation = GitHubInstallation.from(
      workspace.connectionTo(GitHubInstallation.SOURCE),
    );

    if (!installation || writing.files.length === 0) {
      return null;
    }

    const into = await this.into(team);

    if (!into) {
      return null;
    }

    return this.pullRequests.propose({
      installation,
      repository: into,
      branch: writing.branch,
      title: writing.title,
      body: writing.body,
      message: writing.title,
      files: writing.files.map((each) => ({
        path: each.path,
        text: each.text,
      })),
    });
  }

  /**
   * Where it goes: the repository configuration was last read from, or the
   * one somebody pinned before anything had been read at all.
   */
  private async into(team: Team): Promise<Repository | null> {
    const applied = await this.configurations.findFor(team.id);

    return applied?.repository ?? team.configRepository ?? null;
  }
}
