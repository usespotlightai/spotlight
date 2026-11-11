import type { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import type { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';

export interface UsedKey<K> {
  readonly value: string;
  equals(other: K): boolean;
}

export interface StationUse<K extends UsedKey<K>> {
  readonly used: K;
  readonly line: LineKey;
  readonly station: StationKey;
}

export class StationUses<K extends UsedKey<K>> {
  private readonly kind = 'station-uses';

  private constructor(readonly uses: readonly StationUse<K>[]) {}

  static of<K extends UsedKey<K>>(
    uses: readonly StationUse<K>[],
  ): StationUses<K> {
    return new StationUses(uses.map((each) => ({ ...each })));
  }

  static none<K extends UsedKey<K>>(): StationUses<K> {
    return new StationUses<K>([]);
  }

  of(key: K): StationUses<K> {
    return new StationUses(this.uses.filter((each) => each.used.equals(key)));
  }

  get isEmpty(): boolean {
    return this.uses.length === 0;
  }

  get stations(): string {
    return this.uses
      .map((each) => `${each.line.value}/${each.station.value}`)
      .join(', ');
  }

  equals(other: StationUses<K>): boolean {
    return (
      this.kind === other.kind &&
      this.uses.length === other.uses.length &&
      this.uses.every((each, index) => {
        const theirs = other.uses[index];

        return (
          theirs !== undefined &&
          each.used.equals(theirs.used) &&
          each.line.equals(theirs.line) &&
          each.station.equals(theirs.station)
        );
      })
    );
  }
}
