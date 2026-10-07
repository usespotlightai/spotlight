export class HookDefinitionMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(key: string) {
    super(`Hook ${key} changed while saving. Please try again.`);
    this.name = 'HookDefinitionMovedOnError';
  }
}
