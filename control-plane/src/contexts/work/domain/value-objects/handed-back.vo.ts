import type { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import type { HandBack } from '@work/domain/value-objects/hand-back';
import type { Station } from '@work/domain/value-objects/station.vo';

export class HandedBack {
  private constructor(
    readonly next: HandBack,
    readonly station: StationName,
    readonly summary: string | null,
  ) {}

  static to(input: {
    here: Station;
    into: Station | null;
    summary: string | null;
  }): HandedBack {
    const summary = input.summary?.trim() || null;

    if (!input.into) {
      return new HandedBack('continue', input.here.name, summary);
    }

    return new HandedBack(
      input.into.isCompleted ? 'finish' : 'move-on',
      input.into.name,
      summary,
    );
  }

  static rehydrate(input: {
    next: HandBack;
    station: StationName;
    summary: string | null;
  }): HandedBack {
    return new HandedBack(
      input.next,
      input.station,
      input.summary?.trim() || null,
    );
  }

  equals(other: HandedBack): boolean {
    return (
      this.next === other.next &&
      this.station.equals(other.station) &&
      this.summary === other.summary
    );
  }
}
