export class ChangeStacksUnavailableError extends Error {
  readonly kind = 'upstream-error' as const;

  constructor() {
    super('Change stacks are not set up on this deployment.');
    this.name = 'ChangeStacksUnavailableError';
  }
}
