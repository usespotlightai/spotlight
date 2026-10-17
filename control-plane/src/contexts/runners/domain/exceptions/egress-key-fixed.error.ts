export class EgressKeyFixedError extends Error {
  readonly violation = 'invalid' as const;

  readonly field = 'key';

  constructor(
    readonly key: string,
    readonly because: string,
  ) {
    super(`Egress ${key} ${because}.`);
    this.name = 'EgressKeyFixedError';
  }
}
