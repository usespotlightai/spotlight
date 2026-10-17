export class PoolTokenUsage {
  private constructor(
    readonly given: boolean,
    readonly inUse: boolean,
  ) {}

  static of(input: { given: boolean; inUse: boolean }): PoolTokenUsage {
    return new PoolTokenUsage(input.given, input.inUse);
  }
}
