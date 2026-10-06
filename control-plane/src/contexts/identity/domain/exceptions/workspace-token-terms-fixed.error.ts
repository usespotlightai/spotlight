export class WorkspaceTokenTermsFixedError extends Error {
  readonly violation = 'invalid' as const;

  constructor(
    readonly field: string,
    readonly because: string,
  ) {
    super(`Workspace token ${field} ${because}.`);
    this.name = 'WorkspaceTokenTermsFixedError';
  }
}
