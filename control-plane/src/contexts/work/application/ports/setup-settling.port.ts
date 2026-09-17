import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const SETUP_SETTLING = Symbol('SETUP_SETTLING');

export interface SetupSettlingPort {
  forTeam(teamId: TeamId): Promise<void>;
}
