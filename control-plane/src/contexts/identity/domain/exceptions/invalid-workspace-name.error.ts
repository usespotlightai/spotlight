export class InvalidWorkspaceNameError extends Error {
  readonly violation = 'invalid' as const;

  constructor(readonly because: string) {
    super(`Workspace name ${because}.`);
    this.name = 'InvalidWorkspaceNameError';
  }
}
