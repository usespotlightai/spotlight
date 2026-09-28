export class NotOnTeamError extends Error {
  readonly violation = 'not-found' as const;

  constructor(teamId: string) {
    super(`There is no team ${teamId} for this caller`);
    this.name = 'NotOnTeamError';
  }
}
