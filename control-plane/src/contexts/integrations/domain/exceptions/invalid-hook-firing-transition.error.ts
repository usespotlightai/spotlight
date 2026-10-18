export class InvalidHookFiringTransitionError extends Error {
  readonly kind = 'conflict' as const;

  constructor(reason: string) {
    super(`Hook firing ${reason}.`);
    this.name = 'InvalidHookFiringTransitionError';
  }
}
