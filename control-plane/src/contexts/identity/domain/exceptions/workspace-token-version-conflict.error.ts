export class WorkspaceTokenVersionConflictError extends Error {
  readonly kind = 'conflict' as const;

  constructor(tokenId: string) {
    super(
      `Workspace token ${tokenId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'WorkspaceTokenVersionConflictError';
  }
}
