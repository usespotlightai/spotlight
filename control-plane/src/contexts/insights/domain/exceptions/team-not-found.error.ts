export class TeamNotFoundError extends Error {
  readonly kind = 'not-found' as const;

  constructor(teamId: string) {
    super(`Team ${teamId} not found.`);
    this.name = 'TeamNotFoundError';
  }
}
