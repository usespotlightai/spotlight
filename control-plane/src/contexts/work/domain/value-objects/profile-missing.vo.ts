import type { ProfileKey } from '@shared-kernel/domain/value-objects/profile-key.vo';

export class ProfileMissing {
  readonly code = 'harness_profile_unknown';

  private constructor(readonly profile: ProfileKey) {}

  static of(profile: ProfileKey): ProfileMissing {
    return new ProfileMissing(profile);
  }
}
