import type { ProfileKey } from '@shared-kernel/domain/value-objects/profile-key.vo';
import type { RefusalReason } from '@work/domain/value-objects/refusal-reason';

export class ProfileMissing implements RefusalReason {
  readonly code = 'harness_profile_unknown';

  private constructor(readonly profile: ProfileKey) {}

  static of(profile: ProfileKey): ProfileMissing {
    return new ProfileMissing(profile);
  }

  get description(): string {
    return `The station uses harness profile ${this.profile.value}, which this team does not have. Add the profile to the team’s configuration, or have the station use another one.`;
  }
}
