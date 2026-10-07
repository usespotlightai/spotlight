export class PoolTokenSpentError extends Error {
  readonly violation = 'invalid' as const;

  readonly field = 'token';

  readonly because = 'was used before. Pool tokens work once only';

  constructor() {
    super('Pool token was used before. Please give a new one.');
    this.name = 'PoolTokenSpentError';
  }
}
