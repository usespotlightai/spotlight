import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const LINKED_HOSTS = Symbol('LINKED_HOSTS');

export interface LinkedHost {
  readonly source: string;
  readonly handle: string | null;
}

export interface LinkedHostsPort {
  ofTeam(teamId: TeamId): Promise<readonly LinkedHost[]>;
}
