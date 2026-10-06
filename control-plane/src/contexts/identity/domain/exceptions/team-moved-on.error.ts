export class TeamMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(teamId: string) {
    super(
      `Team ${teamId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'TeamMovedOnError';
  }
}
