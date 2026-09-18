import type { TeamsPort } from '@configuration/application/ports/teams.port';
import type { ReadConfiguration } from '@configuration/application/services/read-configuration.service';
import type { ConfigurationHomeRepository } from '@configuration/domain/repositories/configuration-home.repository';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface ConfigurationTouched {
  readonly workspaceId: WorkspaceId;
  readonly repository: string;
}

export class ConfigurationNotices {
  constructor(
    private readonly teams: TeamsPort,
    private readonly homes: ConfigurationHomeRepository,
    private readonly reading: ReadConfiguration,
  ) {}

  async touched(notice: ConfigurationTouched): Promise<void> {
    const repository = Repository.of(notice.repository);
    const installed = await this.teams.inWorkspace(notice.workspaceId);

    for (const team of installed) {
      const home = await this.homes.find(team.teamId);

      if (!home || home.listensTo(repository)) {
        await this.reading.read(team);
      }
    }
  }
}
