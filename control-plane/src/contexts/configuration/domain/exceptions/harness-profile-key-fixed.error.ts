export class HarnessProfileKeyFixedError extends Error {
  readonly violation = 'invalid' as const;

  readonly field = 'key';

  constructor(
    readonly key: string,
    readonly because: string,
  ) {
    super(`Harness profile ${key} ${because}.`);
    this.name = 'HarnessProfileKeyFixedError';
  }
}
