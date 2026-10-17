import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const INTEGRATION_CURSORS = Symbol('INTEGRATION_CURSORS');

export interface PollState {
  readonly cursor: string | null;
  readonly ranAt: Date | null;
}

export interface IntegrationCursorsPort {
  read(teamId: TeamId, integration: string): Promise<PollState>;

  claimTurn(
    teamId: TeamId,
    integration: string,
    seen: PollState,
    at: Date,
  ): Promise<boolean>;

  advance(
    teamId: TeamId,
    integration: string,
    cursor: string | null,
    claimedAt: Date,
  ): Promise<boolean>;
}
