export class TeamMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(teamId: string) {
    super(
      `This team has been changed since it was read, and cannot be written over (${teamId})`,
    );
    this.name = 'TeamMovedOnError';
  }
}
