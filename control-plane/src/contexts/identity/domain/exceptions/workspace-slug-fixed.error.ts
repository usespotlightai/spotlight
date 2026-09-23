export class WorkspaceSlugFixedError extends Error {
  readonly violation = 'invalid' as const;

  readonly field = 'slug';

  constructor(
    readonly slug: string,
    readonly because: string,
  ) {
    super(`The ${slug} workspace ${because}`);
    this.name = 'WorkspaceSlugFixedError';
  }
}
