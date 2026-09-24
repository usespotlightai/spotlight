import type { HarnessProfile } from '@configuration/domain/aggregates/harness-profile.aggregate';
import type { HarnessProfileId } from '@configuration/domain/value-objects/harness-profile-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const HARNESS_PROFILES = Symbol('HARNESS_PROFILES');

export interface HarnessProfileRepository {
  withId(id: HarnessProfileId): Promise<HarnessProfile | null>;

  ofTeam(teamId: TeamId): Promise<readonly HarnessProfile[]>;

  save(profile: HarnessProfile): Promise<void>;
}
