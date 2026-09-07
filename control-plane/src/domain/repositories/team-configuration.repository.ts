import type { TeamConfiguration } from '@domain/aggregates/team-configuration.aggregate';
import type { TeamId } from '@domain/value-objects/team-id.vo';

/** Kept rather than fetched, so a delivery never waits on a host. */
export interface TeamConfigurationRepository {
  findFor(teamId: TeamId): Promise<TeamConfiguration | null>;

  /** Every team's configuration, for the poller to find what it must fetch. */
  all(): Promise<readonly TeamConfiguration[]>;

  save(configuration: TeamConfiguration): Promise<void>;
}
