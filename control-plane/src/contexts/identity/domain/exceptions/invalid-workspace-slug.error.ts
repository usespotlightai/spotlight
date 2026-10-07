export class InvalidWorkspaceSlugError extends Error {
  readonly violation = 'invalid' as const;

  constructor(readonly because: string) {
    super(`Workspace URL ${because}.`);
    this.name = 'InvalidWorkspaceSlugError';
  }
}
