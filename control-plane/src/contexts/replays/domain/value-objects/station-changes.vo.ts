import type { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';

type StationChangeKind = 'added' | 'removed' | 'changed';

export interface StationChange {
  readonly part: string;
  readonly name: string | null;
  readonly kind: StationChangeKind;
  readonly was: string | null;
  readonly now: string | null;
}

export class StationChanges {
  private constructor(
    readonly from: StationFingerprint,
    readonly changes: readonly StationChange[],
  ) {}

  static of(
    from: StationFingerprint,
    changes: readonly StationChange[],
  ): StationChanges {
    return new StationChanges(
      from,
      changes.map((each) => ({ ...each })),
    );
  }

  static none(from: StationFingerprint): StationChanges {
    return new StationChanges(from, []);
  }
}
