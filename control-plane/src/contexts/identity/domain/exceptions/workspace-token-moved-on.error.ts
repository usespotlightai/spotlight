export class WorkspaceTokenMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(tokenId: string) {
    super(
      `This workspace token has been changed since it was read, and cannot be written over (${tokenId})`,
    );
    this.name = 'WorkspaceTokenMovedOnError';
  }
}
