import type { TeamHostRunsPort } from '@memory/application/ports/team-host-runs.port';
import type { TeamRunsPort } from '@runs/application/ports/team-runs.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

/** Runs that work ordered for the team's tasks and chats, not replays, searches or other assist sessions. */
const TEAM_WORK = 'work';

/** The team's newest completed run of its own work hosts its memory sessions, as the runs context knows it. */
export class TeamHostRunsAdapter implements TeamHostRunsPort {
  constructor(private readonly runs: TeamRunsPort) {}

  hostOf(teamId: TeamId): Promise<RunId | null> {
    return this.runs.newestCompletedOfTeam(teamId, TEAM_WORK);
  }
}
