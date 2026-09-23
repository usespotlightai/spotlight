import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const CONFIGURATION_STATUS = Symbol('CONFIGURATION_STATUS');

export interface ConfigurationStatusPort {
  isApplied(teamId: TeamId): Promise<boolean>;
}
