export class InvalidWorkspaceSlugError extends Error {
  readonly kind = 'invalid' as const;

  constructor(readonly because: string) {
    super(`Workspace URL ${because}.`);
    this.name = 'InvalidWorkspaceSlugError';
  }
}
