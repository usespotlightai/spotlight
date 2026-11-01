export class CallSecretsExpiredError extends Error {
  readonly kind = 'conflict' as const;

  constructor(id: string, state: string) {
    super(
      `Network call ${id} is ${state}. Its secrets can no longer be redeemed.`,
    );
    this.name = 'CallSecretsExpiredError';
  }
}
