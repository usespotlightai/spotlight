export class TeamOutsideWorkspaceError extends Error {
  readonly kind = 'invalid' as const;

  constructor(teamId: string) {
    super(`Team ${teamId} is not in this workspace.`);
    this.name = 'TeamOutsideWorkspaceError';
  }
}
