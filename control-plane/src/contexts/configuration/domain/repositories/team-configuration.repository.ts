import type { TeamConfiguration } from '@configuration/domain/aggregates/team-configuration.aggregate';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export type Keeping = 'kept' | 'superseded';

export interface TeamConfigurationRepository {
  findFor(teamId: TeamId): Promise<TeamConfiguration | null>;

  save(configuration: TeamConfiguration): Promise<Keeping>;
}
