export class TokenTrustAlreadyDefinedError extends Error {
  readonly violation = 'conflict' as const;

  constructor(readonly key: string) {
    super(`The workspace already has a token trust keyed ${key}`);
    this.name = 'TokenTrustAlreadyDefinedError';
  }
}
