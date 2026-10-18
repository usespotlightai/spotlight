export class InvalidTokenScopeError extends Error {
  readonly kind = 'invalid' as const;

  constructor(readonly because: string) {
    super(`Token scopes ${because}.`);
    this.name = 'InvalidTokenScopeError';
  }
}
