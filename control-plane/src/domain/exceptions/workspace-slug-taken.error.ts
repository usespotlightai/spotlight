export class WorkspaceSlugTakenError extends Error {
  readonly violation = 'conflict' as const;

  constructor(readonly slug: string) {
    super(`The workspace URL "${slug}" is already taken`);
    this.name = 'WorkspaceSlugTakenError';
  }
}
