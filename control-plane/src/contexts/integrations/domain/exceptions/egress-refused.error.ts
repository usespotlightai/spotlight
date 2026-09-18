export class EgressRefusedError extends Error {
  readonly violation = 'not-allowed' as const;

  constructor(host: string, reason: string) {
    super(`${host}: ${reason}`);
    this.name = 'EgressRefusedError';
  }
}
