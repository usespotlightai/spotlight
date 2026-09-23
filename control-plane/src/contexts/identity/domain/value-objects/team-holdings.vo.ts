export class TeamHoldings {
  private readonly kind = 'team-holdings';

  private constructor(readonly held: readonly string[]) {}

  static of(held: readonly string[]): TeamHoldings {
    return new TeamHoldings([...held].sort());
  }

  static none(): TeamHoldings {
    return new TeamHoldings([]);
  }

  get isEmpty(): boolean {
    return this.held.length === 0;
  }

  equals(other: TeamHoldings): boolean {
    return (
      this.kind === other.kind &&
      this.held.length === other.held.length &&
      this.held.every((each, at) => each === other.held[at])
    );
  }
}
