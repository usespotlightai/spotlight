export class TokenTrustBeyondGrantorError extends Error {
  constructor(key: string) {
    super(
      `The ${key} token trust would grant scopes the token defining it does not hold`,
    );
    this.name = 'TokenTrustBeyondGrantorError';
  }
}
