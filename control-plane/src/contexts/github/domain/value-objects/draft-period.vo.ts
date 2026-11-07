export class DraftPeriod {
  private constructor(
    readonly from: Date,
    readonly to: Date | null,
  ) {}

  static of(input: { from: Date; to: Date | null }): DraftPeriod {
    return new DraftPeriod(input.from, input.to);
  }

  static openedAt(from: Date): DraftPeriod {
    return new DraftPeriod(from, null);
  }

  static openOf(periods: readonly DraftPeriod[]): DraftPeriod | null {
    const last = periods[periods.length - 1];

    return last?.isOpen ? last : null;
  }

  static sameAll(
    one: readonly DraftPeriod[],
    other: readonly DraftPeriod[],
  ): boolean {
    return (
      one.length === other.length &&
      one.every((each, at) => {
        const counterpart = other[at];

        return counterpart !== undefined && each.equals(counterpart);
      })
    );
  }

  get isOpen(): boolean {
    return this.to === null;
  }

  closedAt(to: Date): DraftPeriod {
    return new DraftPeriod(this.from, to);
  }

  equals(other: DraftPeriod): boolean {
    return (
      this.from.getTime() === other.from.getTime() &&
      (this.to?.getTime() ?? null) === (other.to?.getTime() ?? null)
    );
  }
}
