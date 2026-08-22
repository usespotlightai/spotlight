export class InvalidIdentifierError extends Error {
  readonly violation = 'invalid' as const;

  constructor(kind: string) {
    super(`A ${kind} identifier must not be empty`);
    this.name = 'InvalidIdentifierError';
  }
}
