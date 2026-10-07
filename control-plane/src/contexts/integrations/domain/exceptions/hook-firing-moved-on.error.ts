export class HookFiringMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(id: string) {
    super(`Hook firing ${id} changed since it was loaded. Please try again.`);
    this.name = 'HookFiringMovedOnError';
  }
}
