import type { ProfileKey } from '@work/domain/value-objects/profile-key.vo';
import type { RefusalReason } from '@work/domain/value-objects/run-outcome.vo';
import type { StationName } from '@work/domain/value-objects/station-name.vo';

export class ProfileMissing implements RefusalReason {
  private constructor(
    readonly station: StationName,
    readonly profile: ProfileKey,
  ) {}

  static at(station: StationName, profile: ProfileKey): ProfileMissing {
    return new ProfileMissing(station, profile);
  }

  get saying(): string {
    return `harness_profile_unknown: The ${this.station.value} station names the ${this.profile.value} harness profile, which its team does not hold`;
  }
}
