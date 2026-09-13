import type { TeamId } from '@domain/value-objects/team-id.vo';

export const TraceAccess = {
  sameTeam(runsTeam: TeamId | null, tasksTeam: TeamId | null): boolean {
    return (
      runsTeam !== null && tasksTeam !== null && runsTeam.equals(tasksTeam)
    );
  },
};
