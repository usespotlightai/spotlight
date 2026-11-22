import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const TEAM_RUNS = Symbol('TEAM_RUNS');

export interface TeamRunsPort {
  /**
   * The newest run of the team that a requester owner, such as `work` for tasks and chats, ordered and that
   * completed. Null when no such run completed.
   */
  newestCompletedOfTeam(team: TeamId, owner: string): Promise<RunId | null>;
}
