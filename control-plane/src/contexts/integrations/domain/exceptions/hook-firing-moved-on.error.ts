export class HookFiringMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(id: string) {
    super(
      `This hook firing has changed since it was read, and cannot be written over (${id})`,
    );
    this.name = 'HookFiringMovedOnError';
  }
}
