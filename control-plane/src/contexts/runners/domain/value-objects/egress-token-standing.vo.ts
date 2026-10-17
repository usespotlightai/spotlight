export class EgressTokenStanding {
  private constructor(
    readonly given: boolean,
    readonly held: boolean,
  ) {}

  static of(input: { given: boolean; held: boolean }): EgressTokenStanding {
    return new EgressTokenStanding(input.given, input.held);
  }
}
