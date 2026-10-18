export class NowhereToProposeError extends Error {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`A task cannot be proposed there: ${reason}`);
    this.name = 'NowhereToProposeError';
  }
}
