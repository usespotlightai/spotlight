import type { TeamProfile } from '@configuration/application/ports/teams.port';
import type { ConfigurationHomeRepository } from '@configuration/domain/repositories/configuration-home.repository';
import type { TeamConfigurationRepository } from '@configuration/domain/repositories/team-configuration.repository';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface ConfigurationRepo {
  readonly workspaceId: WorkspaceId;
  readonly repository: Repository;
}

export class ConfigurationTarget {
  constructor(
    private readonly configurations: TeamConfigurationRepository,
    private readonly homes: ConfigurationHomeRepository,
  ) {}

  async of(team: TeamProfile): Promise<ConfigurationRepo | null> {
    const [applied, home] = await Promise.all([
      this.configurations.findFor(team.teamId),
      this.homes.find(team.teamId),
    ]);
    const lastRead = applied?.repository ?? null;
    const repository = home ? home.writtenTo(lastRead) : lastRead;

    return repository ? this.at(team, repository) : null;
  }

  at(team: TeamProfile, repository: Repository): ConfigurationRepo | null {
    return team.connected
      ? { workspaceId: team.workspaceId, repository }
      : null;
  }
}
