import type { Team } from '@domain/aggregates/team.aggregate';
import type { Workspace } from '@domain/aggregates/workspace.aggregate';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
import { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import type { Repository } from '@domain/value-objects/repository.vo';

export interface ConfigurationRepo {
  readonly installation: GitHubInstallation;
  readonly repository: Repository;
}

/**
 * The repository a team's configuration is read from and written to, resolved
 * once so reading and writing cannot disagree about which one it is. The
 * repository last read from wins over the one merely pinned.
 */
export class ConfigurationTarget {
  constructor(private readonly configurations: TeamConfigurationRepository) {}

  async of(
    workspace: Workspace,
    team: Team,
  ): Promise<ConfigurationRepo | null> {
    const installation = GitHubInstallation.from(
      workspace.connectionTo(GitHubInstallation.SOURCE),
    );
    const applied = await this.configurations.findFor(team.id);
    const repository = applied?.repository ?? team.configRepository ?? null;

    return installation && repository ? { installation, repository } : null;
  }
}
