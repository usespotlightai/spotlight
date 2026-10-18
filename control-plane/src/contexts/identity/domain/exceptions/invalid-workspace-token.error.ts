export class InvalidWorkspaceTokenError extends Error {
  readonly kind = 'invalid' as const;

  constructor(
    readonly field: string,
    readonly because: string,
  ) {
    super(`Workspace token ${field} ${because}.`);
    this.name = 'InvalidWorkspaceTokenError';
  }
}
