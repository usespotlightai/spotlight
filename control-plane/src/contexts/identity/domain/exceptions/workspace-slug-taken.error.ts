export class WorkspaceSlugTakenError extends Error {
  readonly kind = 'conflict' as const;

  constructor(readonly slug: string) {
    super(`Workspace URL ${slug} is already taken. Please choose another.`);
    this.name = 'WorkspaceSlugTakenError';
  }
}
