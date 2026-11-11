import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const TEAM_WELCOMES = Symbol('TEAM_WELCOMES');

export interface TeamWelcomesPort {
  welcomed(teamId: TeamId): Promise<boolean>;

  record(teamId: TeamId): Promise<void>;

  forget(teamId: TeamId): Promise<void>;
}
