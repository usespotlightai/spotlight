export class TeamNotFoundError extends Error {
  readonly violation = 'not-found' as const;

  constructor(teamId: string) {
    super(`Team ${teamId} not found.`);
    this.name = 'TeamNotFoundError';
  }
}
