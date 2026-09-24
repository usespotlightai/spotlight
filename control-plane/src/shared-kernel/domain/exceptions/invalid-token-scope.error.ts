export class InvalidTokenScopeError extends Error {
  readonly violation = 'invalid' as const;

  constructor(readonly because: string) {
    super(`A token's scopes ${because}`);
    this.name = 'InvalidTokenScopeError';
  }
}
