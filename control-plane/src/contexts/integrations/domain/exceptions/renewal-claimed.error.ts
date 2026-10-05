export class RenewalClaimedError extends Error {
  readonly violation = 'conflict' as const;

  constructor(source: string) {
    super(`The ${source} connection is already being renewed`);
    this.name = 'RenewalClaimedError';
  }
}
