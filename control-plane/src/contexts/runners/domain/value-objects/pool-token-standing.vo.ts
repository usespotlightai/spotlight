export class PoolTokenStanding {
  private constructor(
    readonly given: boolean,
    readonly inUse: boolean,
  ) {}

  static of(input: { given: boolean; inUse: boolean }): PoolTokenStanding {
    return new PoolTokenStanding(input.given, input.inUse);
  }
}
