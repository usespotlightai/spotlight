export class TokenTrustBeyondGrantorError extends Error {
  constructor(key: string) {
    super(`Token trust ${key} grants scopes your token does not have.`);
    this.name = 'TokenTrustBeyondGrantorError';
  }
}
