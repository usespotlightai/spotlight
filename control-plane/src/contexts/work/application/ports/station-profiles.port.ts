import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { HarnessProfileShape } from '@work/application/contracts/harness-profile.contract';

export const STATION_PROFILES = Symbol('STATION_PROFILES');

export interface StationProfilesPort {
  named(teamId: TeamId, key: string): Promise<HarnessProfileShape | null>;
}
