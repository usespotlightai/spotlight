export class RunnerTokenTakenError extends Error {
  readonly violation = 'invalid' as const;

  readonly field = 'token';

  readonly because =
    'is already another runner’s token; give each runner its own';

  constructor() {
    super('A runner token is already another runner’s');
    this.name = 'RunnerTokenTakenError';
  }
}
