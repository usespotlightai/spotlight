export class WrongCallSecretsTokenError extends Error {
  readonly kind = 'not-allowed' as const;

  constructor(id: string) {
    super(`The token does not redeem the secrets of network call ${id}.`);
    this.name = 'WrongCallSecretsTokenError';
  }
}
