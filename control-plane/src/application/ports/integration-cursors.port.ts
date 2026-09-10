import type { TeamId } from '@domain/value-objects/team-id.vo';

export const INTEGRATION_CURSORS = Symbol('INTEGRATION_CURSORS');

/** Where a team's poll of one host last got to. */
export interface PollState {
  /** What the last poll remembered to ask from; null before the first. */
  readonly cursor: string | null;
  /** When it last ran; null before the first, so the first is always due. */
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
