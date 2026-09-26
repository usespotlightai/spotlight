import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const TraceAccess = {
  sameTeam(reading: TeamId | null, traced: TeamId | null): boolean {
    return reading !== null && traced !== null && reading.equals(traced);
  },
};
