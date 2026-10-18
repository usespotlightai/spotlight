export class HookFiringVersionConflictError extends Error {
  readonly kind = 'conflict' as const;

  constructor(id: string) {
    super(`Hook firing ${id} changed since it was loaded. Please try again.`);
    this.name = 'HookFiringVersionConflictError';
  }
}
