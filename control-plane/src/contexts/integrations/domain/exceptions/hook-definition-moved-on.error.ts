export class HookDefinitionMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(key: string) {
    super(`The hook ${key} was defined again while this was`);
    this.name = 'HookDefinitionMovedOnError';
  }
}
