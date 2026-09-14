import type { Team } from '@domain/aggregates/team.aggregate';
import type { Workspace } from '@domain/aggregates/workspace.aggregate';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
import { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import type { Repository } from '@domain/value-objects/repository.vo';

export interface ConfigurationRepo {
  readonly installation: GitHubInstallation;
  readonly repository: Repository;
}

export class ConfigurationTarget {
  constructor(private readonly configurations: TeamConfigurationRepository) {}

  async of(
    workspace: Workspace,
    team: Team,
  ): Promise<ConfigurationRepo | null> {
    const applied = await this.configurations.findFor(team.id);
    const repository = team.configurationWrittenTo(applied?.repository ?? null);

    return repository ? this.at(workspace, repository) : null;
  }

  at(workspace: Workspace, repository: Repository): ConfigurationRepo | null {
    const installation = this.installationOf(workspace);

    return installation ? { installation, repository } : null;
  }

  installationOf(workspace: Workspace): GitHubInstallation | null {
    return GitHubInstallation.from(
      workspace.connectionTo(GitHubInstallation.SOURCE),
    );
  }
}
