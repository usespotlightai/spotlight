import type { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import type { HoldEnd } from '@work/domain/value-objects/hold-end';
import type { Station } from '@work/domain/value-objects/station.vo';

export class Resumption {
  private constructor(
    readonly next: HoldEnd,
    readonly station: StationName,
    readonly summary: string | null,
  ) {}

  static to(input: {
    here: Station;
    into: Station | null;
    summary: string | null;
  }): Resumption {
    const summary = input.summary?.trim() || null;

    if (!input.into) {
      return new Resumption('continue', input.here.name, summary);
    }

    return new Resumption(
      input.into.isCompleted ? 'finish' : 'move-on',
      input.into.name,
      summary,
    );
  }

  static rehydrate(input: {
    next: HoldEnd;
    station: StationName;
    summary: string | null;
  }): Resumption {
    return new Resumption(
      input.next,
      input.station,
      input.summary?.trim() || null,
    );
  }

  equals(other: Resumption): boolean {
    return (
      this.next === other.next &&
      this.station.equals(other.station) &&
      this.summary === other.summary
    );
  }
}
