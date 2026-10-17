export class EgressTokenUsage {
  private constructor(
    readonly used: boolean,
    readonly inUse: boolean,
  ) {}

  static of(input: { used: boolean; inUse: boolean }): EgressTokenUsage {
    return new EgressTokenUsage(input.used, input.inUse);
  }
}
