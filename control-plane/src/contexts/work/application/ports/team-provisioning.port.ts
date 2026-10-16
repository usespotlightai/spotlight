import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const TEAM_PROVISIONING = Symbol('TEAM_PROVISIONING');

export const PROVISIONINGS = ['pending', 'done', 'failed'] as const;

export type Provisioning = (typeof PROVISIONINGS)[number];

export interface TeamProvisioningPort {
  of(teamId: TeamId): Promise<Provisioning>;
}
