export class TeamOutsideWorkspaceError extends Error {
  readonly violation = 'invalid' as const;

  constructor(teamId: string) {
    super(`Sorry, team ${teamId} is not in this workspace.`);
    this.name = 'TeamOutsideWorkspaceError';
  }
}
