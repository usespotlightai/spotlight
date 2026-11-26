import type { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import type { RefusalReason } from '@work/domain/value-objects/refusal-reason';

export class RepositoriesMissing implements RefusalReason {
  private constructor(readonly station: StationName) {}

  static at(station: StationName): RepositoriesMissing {
    return new RepositoriesMissing(station);
  }

  get description(): string {
    return `line_has_no_repositories: This line has no repositories. Add one in the line’s configuration. Station: ${this.station.value}`;
  }
}
