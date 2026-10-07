export class AlreadyOnTheTeamError extends Error {
  readonly violation = 'conflict' as const;

  constructor(email: string) {
    super(`This team already includes ${email}.`);
    this.name = 'AlreadyOnTheTeamError';
  }
}
