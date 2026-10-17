export class EgressTokenStanding {
  private constructor(
    readonly given: boolean,
    readonly inUse: boolean,
  ) {}

  static of(input: { given: boolean; inUse: boolean }): EgressTokenStanding {
    return new EgressTokenStanding(input.given, input.inUse);
  }
}
