export class NowhereToProposeError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`A task cannot be proposed there: ${reason}`);
    this.name = 'NowhereToProposeError';
  }
}
