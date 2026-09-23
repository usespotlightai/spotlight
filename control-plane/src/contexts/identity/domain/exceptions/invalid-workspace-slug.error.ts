export class InvalidWorkspaceSlugError extends Error {
  readonly violation = 'invalid' as const;

  constructor(readonly because: string) {
    super(`A workspace URL ${because}`);
    this.name = 'InvalidWorkspaceSlugError';
  }
}
