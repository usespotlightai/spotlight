export class CallSecretsRedeemedError extends Error {
  readonly kind = 'conflict' as const;

  constructor(id: string) {
    super(`The secrets of network call ${id} were already redeemed.`);
    this.name = 'CallSecretsRedeemedError';
  }
}
