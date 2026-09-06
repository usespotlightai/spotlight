import type { TeamId } from '@domain/value-objects/team-id.vo';

/**
 * Who may read whose trace. A run studies only its own team's work, so an agent
 * reaching for a trace reaches no further than the person who filed the run.
 */
export const TraceAccess = {
  sameTeam(runsTeam: TeamId | null, tasksTeam: TeamId | null): boolean {
    return (
      runsTeam !== null && tasksTeam !== null && runsTeam.equals(tasksTeam)
    );
  },
};
