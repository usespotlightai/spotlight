export class InvalidWorkspaceSlugError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`A workspace URL ${reason}`);
    this.name = 'InvalidWorkspaceSlugError';
  }
}
