import type { TeamConfiguration } from '@domain/aggregates/team-configuration.aggregate';
import type { TeamId } from '@domain/value-objects/team-id.vo';

/**
 * Kept rather than fetched, so a delivery is never waiting on a host and a
 * team goes on listening whether or not its repository can be reached.
 *
 * One team has one reading, so there is nothing here to list: it is found by
 * whose it is, and replaced whole when it is read again.
 */
export interface TeamConfigurationRepository {
  findFor(teamId: TeamId): Promise<TeamConfiguration | null>;

  save(configuration: TeamConfiguration): Promise<void>;
}
