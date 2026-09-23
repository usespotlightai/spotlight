import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const TEAM_HOLDINGS = Symbol('TEAM_HOLDINGS');

export interface TeamHolder {
  heldBy(teamId: TeamId): Promise<readonly string[]>;
}

export interface TeamHoldingsPort {
  register(holder: TeamHolder): void;

  of(teamId: TeamId): Promise<readonly string[]>;
}
