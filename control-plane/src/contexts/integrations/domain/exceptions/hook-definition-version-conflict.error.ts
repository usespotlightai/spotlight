export class HookDefinitionVersionConflictError extends Error {
  readonly kind = 'conflict' as const;

  constructor(key: string) {
    super(`Hook ${key} changed while saving. Please try again.`);
    this.name = 'HookDefinitionVersionConflictError';
  }
}
