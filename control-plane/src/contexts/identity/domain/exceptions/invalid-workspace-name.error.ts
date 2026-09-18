export class InvalidWorkspaceNameError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`A workspace name ${reason}`);
    this.name = 'InvalidWorkspaceNameError';
  }
}
