export interface StationUse {
  readonly name: string;
  readonly by: string;
}

export class StationUses {
  private readonly kind = 'station-uses';

  private constructor(readonly uses: readonly StationUse[]) {}

  static of(uses: readonly StationUse[]): StationUses {
    return new StationUses(uses.map((each) => ({ ...each })));
  }

  static none(): StationUses {
    return new StationUses([]);
  }

  of(key: { readonly value: string }): StationUses {
    return new StationUses(this.uses.filter((each) => each.name === key.value));
  }

  get isEmpty(): boolean {
    return this.uses.length === 0;
  }

  get stations(): string {
    return this.uses.map((each) => each.by).join(', ');
  }

  equals(other: StationUses): boolean {
    return (
      this.kind === other.kind &&
      JSON.stringify(this.uses) === JSON.stringify(other.uses)
    );
  }
}
