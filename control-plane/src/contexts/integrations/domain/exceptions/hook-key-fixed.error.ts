export class HookKeyFixedError extends Error {
  readonly violation = 'invalid' as const;

  constructor(
    key: string,
    readonly because: string,
  ) {
    super(`Hook ${key} ${because}.`);
    this.name = 'HookKeyFixedError';
  }
}
