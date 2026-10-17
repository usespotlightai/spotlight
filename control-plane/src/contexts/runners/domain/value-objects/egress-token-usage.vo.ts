export class EgressTokenUsage {
  private constructor(
    readonly given: boolean,
    readonly inUse: boolean,
  ) {}

  static of(input: { given: boolean; inUse: boolean }): EgressTokenUsage {
    return new EgressTokenUsage(input.given, input.inUse);
  }
}
