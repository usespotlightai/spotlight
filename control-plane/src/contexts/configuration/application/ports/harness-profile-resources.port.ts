import type { ProfileKey } from '@configuration/domain/value-objects/profile-key.vo';
import type { ProfileSettings } from '@configuration/domain/value-objects/profile-settings.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const HARNESS_PROFILE_RESOURCES = Symbol('HARNESS_PROFILE_RESOURCES');

export interface HarnessProfileRecord {
  readonly id: string;
  readonly version: number;
  readonly teamId: TeamId;
  readonly key: ProfileKey;
  readonly settings: ProfileSettings;
}

export interface HarnessProfileResourcesPort {
  withId(id: string): Promise<HarnessProfileRecord | null>;

  at(teamId: TeamId, key: string): Promise<HarnessProfileRecord | null>;

  ofTeam(teamId: TeamId): Promise<readonly HarnessProfileRecord[]>;
}
