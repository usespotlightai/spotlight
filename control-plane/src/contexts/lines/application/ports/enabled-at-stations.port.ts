import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const ENABLED_AT_STATIONS = Symbol('ENABLED_AT_STATIONS');

export type StationReference = 'tool' | 'skill' | 'profile';

export interface EnabledAtStation {
  readonly name: string;
  readonly line: string;
  readonly station: string;
}

export interface EnabledAtStationsPort {
  onTeam(
    teamId: TeamId,
    reference: StationReference,
  ): Promise<readonly EnabledAtStation[]>;
}
