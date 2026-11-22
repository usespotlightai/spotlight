import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const TEAM_RUNS = Symbol('TEAM_RUNS');

export interface TeamRunsPort {
  /** The run of the team that completed last, or null when none of its runs completed. */
  newestCompletedOfTeam(team: TeamId): Promise<RunId | null>;
}
