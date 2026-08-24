export class RevokedRunnerError extends Error {
  constructor() {
    super('This runner’s token has been revoked');
    this.name = 'RevokedRunnerError';
  }
}
