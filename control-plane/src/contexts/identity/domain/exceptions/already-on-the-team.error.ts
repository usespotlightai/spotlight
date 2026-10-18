export class AlreadyOnTheTeamError extends Error {
  readonly kind = 'conflict' as const;

  constructor(team: string) {
    super(`${team} already includes this person.`);
    this.name = 'AlreadyOnTheTeamError';
  }
}
