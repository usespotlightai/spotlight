import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const GIVEN_AT_STATIONS = Symbol('GIVEN_AT_STATIONS');

export type StationGift = 'tool' | 'skill' | 'profile';

export interface GivenAtStation {
  readonly name: string;
  readonly line: string;
  readonly station: string;
}

export interface GivenAtStationsPort {
  onTeam(teamId: TeamId, gift: StationGift): Promise<readonly GivenAtStation[]>;
}
