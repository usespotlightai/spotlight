export class PoolTokenTakenError extends Error {
  readonly violation = 'invalid' as const;

  readonly field = 'token';

  readonly because = 'is already another pool’s token; give each pool its own';

  constructor() {
    super('A pool token is already another pool’s');
    this.name = 'PoolTokenTakenError';
  }
}
