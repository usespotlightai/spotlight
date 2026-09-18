import type { ConfigurationHome } from '@configuration/domain/aggregates/configuration-home.aggregate';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export interface ConfigurationHomeRepository {
  find(teamId: TeamId): Promise<ConfigurationHome | null>;

  save(home: ConfigurationHome): Promise<void>;
}
