export class EgressBlockedError extends Error {
  readonly kind = 'not-allowed' as const;

  constructor(host: string, reason: string) {
    super(`Outbound call to ${host} blocked. ${reason}`);
    this.name = 'EgressBlockedError';
  }
}
