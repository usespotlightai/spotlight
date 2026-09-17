import type { AppliedConfigurationPort } from '@configuration/application/ports/applied-configuration.port';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { ConfigurationStatusPort } from '@work/application/ports/configuration-status.port';

export class ConfigurationStatus implements ConfigurationStatusPort {
  constructor(private readonly applied: AppliedConfigurationPort) {}

  keptIn(teamId: TeamId): Promise<Repository | null> {
    return this.applied.keptIn(teamId);
  }

  async isApplied(teamId: TeamId): Promise<boolean> {
    return (await this.applied.of(teamId)) !== null;
  }
}
