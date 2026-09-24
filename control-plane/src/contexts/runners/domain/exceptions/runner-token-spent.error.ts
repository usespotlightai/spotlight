export class RunnerTokenSpentError extends Error {
  readonly violation = 'invalid' as const;

  readonly field = 'token';

  readonly because =
    'was held by a runner that has been revoked and can’t be used again; give this runner a new token';

  constructor() {
    super('A runner token was held by a runner that has been revoked');
    this.name = 'RunnerTokenSpentError';
  }
}
