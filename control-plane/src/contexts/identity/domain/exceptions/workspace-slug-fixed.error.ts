export class WorkspaceSlugFixedError extends Error {
  readonly violation = 'invalid' as const;

  readonly field = 'slug';

  constructor(
    readonly slug: string,
    readonly because: string,
  ) {
    super(`Workspace ${slug} ${because}.`);
    this.name = 'WorkspaceSlugFixedError';
  }
}
