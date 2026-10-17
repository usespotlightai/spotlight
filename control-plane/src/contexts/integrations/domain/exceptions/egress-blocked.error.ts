export class EgressBlockedError extends Error {
  readonly violation = 'not-allowed' as const;

  constructor(host: string, reason: string) {
    super(`Outbound call to ${host} blocked. ${reason}`);
    this.name = 'EgressBlockedError';
  }
}
