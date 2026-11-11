export class TokenUsage {
  private constructor(
    readonly used: boolean,
    readonly heldByAnother: boolean,
  ) {}

  static of(input: { used: boolean; heldByAnother: boolean }): TokenUsage {
    return new TokenUsage(input.used, input.heldByAnother);
  }

  static takenConcurrently(): TokenUsage {
    return new TokenUsage(true, true);
  }
}
