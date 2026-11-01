export class InvalidHostAllowListError extends Error {
  readonly kind = 'invalid' as const;

  constructor(
    readonly entry: string,
    readonly because: string,
  ) {
    super(`Allowed host "${entry}" ${because}.`);
    this.name = 'InvalidHostAllowListError';
  }
}
