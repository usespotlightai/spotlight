import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const HOST_CONNECTION_ROSTER = Symbol('HOST_CONNECTION_ROSTER');

export interface PersonConnection {
  readonly source: string;
  readonly personId: string;
  readonly handle: string | null;
  readonly connectedAt: Date;
}

export interface HostConnectionRosterPort {
  ofTeam(teamId: TeamId): Promise<readonly PersonConnection[]>;
}
