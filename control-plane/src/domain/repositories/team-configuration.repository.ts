import type { TeamConfiguration } from '@domain/aggregates/team-configuration.aggregate';
import type { TeamId } from '@domain/value-objects/team-id.vo';

export interface TeamConfigurationRepository {
  findFor(teamId: TeamId): Promise<TeamConfiguration | null>;

  all(): Promise<readonly TeamConfiguration[]>;

  save(configuration: TeamConfiguration): Promise<void>;
}
