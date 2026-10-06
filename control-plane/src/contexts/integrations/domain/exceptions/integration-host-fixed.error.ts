export class IntegrationHostFixedError extends Error {
  readonly violation = 'invalid' as const;

  readonly field = 'integration';

  constructor(
    readonly source: string,
    readonly because: string,
  ) {
    super(`Integration ${source} ${because}.`);
    this.name = 'IntegrationHostFixedError';
  }
}
