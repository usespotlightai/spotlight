export class PoolTokenStanding {
  private constructor(
    readonly given: boolean,
    readonly held: boolean,
  ) {}

  static of(input: { given: boolean; held: boolean }): PoolTokenStanding {
    return new PoolTokenStanding(input.given, input.held);
  }
}
