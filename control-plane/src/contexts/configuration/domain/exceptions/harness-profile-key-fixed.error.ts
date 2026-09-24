export class HarnessProfileKeyFixedError extends Error {
  readonly violation = 'invalid' as const;

  readonly field = 'key';

  constructor(
    readonly key: string,
    readonly because: string,
  ) {
    super(`The ${key} harness profile ${because}`);
    this.name = 'HarnessProfileKeyFixedError';
  }
}
