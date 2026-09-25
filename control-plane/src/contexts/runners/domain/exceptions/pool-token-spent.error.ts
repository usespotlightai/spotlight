export class PoolTokenSpentError extends Error {
  readonly violation = 'invalid' as const;

  readonly field = 'token';

  readonly because =
    'was given to a pool before, and a pool token is given once, ever: one rotated away, or held by a pool since deleted or replaced, never works again; give a new one';

  constructor() {
    super('A pool token was given before and is spent');
    this.name = 'PoolTokenSpentError';
  }
}
