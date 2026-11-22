import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const TEAM_HOST_RUNS = Symbol('MEMORY_TEAM_HOST_RUNS');

export interface TeamHostRunsPort {
  /**
   * The run a session about the team's memories is based on: the team's run that completed last, whose harness,
   * model and working copy the session takes. Null when none of the team's runs completed.
   */
  hostOf(teamId: TeamId): Promise<RunId | null>;
}
