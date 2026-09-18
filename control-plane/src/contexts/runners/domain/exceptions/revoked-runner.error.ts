export class RevokedRunnerError extends Error {
  readonly violation = 'not-allowed' as const;

  constructor() {
    super('This runner’s token has been revoked');
    this.name = 'RevokedRunnerError';
  }
}
