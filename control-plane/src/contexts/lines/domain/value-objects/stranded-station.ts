import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import type { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';

export interface StationTaskCount {
  readonly stationId: StationId;
  readonly tasks: number;
}

export class TaskCounts {
  static readonly NONE = new TaskCounts(new Map());

  private constructor(
    private readonly byStation: ReadonlyMap<string, number>,
  ) {}

  static of(counts: readonly StationTaskCount[]): TaskCounts {
    return new TaskCounts(
      new Map(counts.map((each) => [each.stationId.value, each.tasks])),
    );
  }

  at(stationId: StationId): number {
    return this.byStation.get(stationId.value) ?? 0;
  }
}

export interface StrandedStation {
  readonly key: StationKey;
  readonly name: StationName;
  readonly tasks: number;
}
