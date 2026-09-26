export class HookAlreadyDefinedError extends Error {
  readonly violation = 'conflict' as const;

  constructor(key: string) {
    super(`The team already has a hook called ${key}`);
    this.name = 'HookAlreadyDefinedError';
  }
}
