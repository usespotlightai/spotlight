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

  get description(): string {
    return `harness_profile_unknown: Harness profile ${this.profile.value} is not in this team. Station: ${this.station.value}`;
  }
}
