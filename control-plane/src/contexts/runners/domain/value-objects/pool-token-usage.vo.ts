export class PoolTokenUsage {
  private constructor(
    readonly used: boolean,
    readonly inUse: boolean,
  ) {}

  static of(input: { used: boolean; inUse: boolean }): PoolTokenUsage {
    return new PoolTokenUsage(input.used, input.inUse);
  }
}
