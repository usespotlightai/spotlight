import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const CONFIGURATION_STATUS = Symbol('CONFIGURATION_STATUS');

export interface ConfigurationStatusPort {
  keptIn(teamId: TeamId): Promise<Repository | null>;

  isApplied(teamId: TeamId): Promise<boolean>;
}
