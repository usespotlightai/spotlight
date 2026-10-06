import { InvalidChangesAskedAboutError } from '@replays/domain/exceptions/invalid-changes-asked-about.error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const MOST_CHANGES = 100;

export interface RawChange {
  readonly stationId: string;
  readonly runId: string;
}

export interface ChangeAskedAbout {
  readonly stationId: string;
  readonly runId: RunId;
}

export const atChange = (position: number, reason: string): string =>
  `Change ${position}: ${reason}.`;

const refused = (position: number, reason: string): never => {
  throw new InvalidChangesAskedAboutError(atChange(position, reason));
};

const changeOf = (raw: RawChange, position: number): ChangeAskedAbout => {
  if (raw.stationId.trim() === '') {
    return refused(position, 'stationId is blank');
  }

  if (raw.runId.trim() === '') {
    return refused(position, 'runId is blank');
  }

  return { stationId: raw.stationId, runId: RunId.of(raw.runId) };
};

const keyOf = (change: ChangeAskedAbout): string =>
  JSON.stringify([change.stationId, change.runId.value]);

export class ChangesAskedAbout {
  private constructor(readonly changes: readonly ChangeAskedAbout[]) {}

  static of(raw: readonly RawChange[]): ChangesAskedAbout {
    if (raw.length > MOST_CHANGES) {
      throw new InvalidChangesAskedAboutError(
        `${raw.length} changes. At most ${MOST_CHANGES} at once.`,
      );
    }

    const distinct = [
      ...new Map(
        raw.map((each, at) => {
          const change = changeOf(each, at + 1);
          return [keyOf(change), change] as const;
        }),
      ).values(),
    ];

    return new ChangesAskedAbout(distinct);
  }

  get stationIds(): readonly string[] {
    return [...new Set(this.changes.map((each) => each.stationId))];
  }
}
