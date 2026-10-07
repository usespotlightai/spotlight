export class InvalidTokenScopeError extends Error {
  readonly violation = 'invalid' as const;

  constructor(readonly because: string) {
    super(`Token scopes ${because}.`);
    this.name = 'InvalidTokenScopeError';
  }
}
