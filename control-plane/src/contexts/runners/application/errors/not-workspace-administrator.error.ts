export class NotWorkspaceAdministratorError extends Error {
  readonly violation = 'not-allowed' as const;

  constructor() {
    super('Only an owner or admin of the workspace looks after its runners');
    this.name = 'NotWorkspaceAdministratorError';
  }
}
