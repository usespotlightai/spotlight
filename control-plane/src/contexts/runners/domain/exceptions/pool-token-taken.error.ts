export class PoolTokenTakenError extends Error {
  readonly violation = 'invalid' as const;

  readonly field = 'token';

  readonly because = 'belongs to another pool. Please give each pool its own';

  constructor() {
    super('Pool token belongs to another pool. Please give each pool its own.');
    this.name = 'PoolTokenTakenError';
  }
}
