export class InvalidIdentifierError extends Error {
  readonly violation = 'invalid' as const;

  constructor(
    kind: string,
    readonly because = 'must not be empty',
  ) {
    super(`A ${kind} identifier ${because}`);
    this.name = 'InvalidIdentifierError';
  }
}
