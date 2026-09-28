export class InvalidHookFiringTransitionError extends Error {
  readonly violation = 'conflict' as const;

  constructor(reason: string) {
    super(`A hook firing ${reason}`);
    this.name = 'InvalidHookFiringTransitionError';
  }
}
