import type { HarnessProfileShape } from '@runs/application/contracts/harness-profile.contract';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const STATION_PROFILES = Symbol('STATION_PROFILES');

export interface StationProfilesPort {
  named(teamId: TeamId, key: string): Promise<HarnessProfileShape | null>;
}
