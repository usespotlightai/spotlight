import type { TeamId } from '@domain/value-objects/team-id.vo';

export const INTEGRATION_CURSORS = Symbol('INTEGRATION_CURSORS');

export interface PollState {
  readonly cursor: string | null;
  readonly ranAt: Date | null;
}

export interface IntegrationCursorsPort {
  read(teamId: TeamId, source: string): Promise<PollState>;

  saved(
    teamId: TeamId,
    source: string,
    cursor: string | null,
    ranAt: Date,
  ): Promise<void>;
}
