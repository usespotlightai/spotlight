export class AlreadyOnTheTeamError extends Error {
  readonly violation = 'conflict' as const;

  constructor(team: string) {
    super(`${team} already includes this person.`);
    this.name = 'AlreadyOnTheTeamError';
  }
}
