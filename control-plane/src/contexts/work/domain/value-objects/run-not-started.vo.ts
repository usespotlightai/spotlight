import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';

export class RunNotStarted {
  private constructor(
    readonly stationId: StationId,
    readonly harness: HarnessId,
  ) {}

  static at(stationId: StationId, harness: HarnessId): RunNotStarted {
    return new RunNotStarted(stationId, harness);
  }

  equals(other: RunNotStarted): boolean {
    return (
      this.stationId.equals(other.stationId) &&
      this.harness.equals(other.harness)
    );
  }
}
