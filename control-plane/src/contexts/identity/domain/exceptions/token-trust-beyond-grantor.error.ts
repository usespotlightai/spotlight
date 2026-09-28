export class TokenTrustBeyondGrantorError extends Error {
  constructor(key: string) {
    super(
      `The ${key} token trust would grant, or grants, scopes the token defining, changing or withdrawing it does not hold`,
    );
    this.name = 'TokenTrustBeyondGrantorError';
  }
}
