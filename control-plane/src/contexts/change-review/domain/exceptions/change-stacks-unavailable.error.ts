export class ChangeStacksUnavailableError extends Error {
  readonly violation = 'refused' as const;

  constructor() {
    super('Change stacks are not set up on this Spotlight deployment');
    this.name = 'ChangeStacksUnavailableError';
  }
}
