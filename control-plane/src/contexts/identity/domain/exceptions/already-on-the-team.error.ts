export class AlreadyOnTheTeamError extends Error {
  readonly violation = 'conflict' as const;

  constructor(email: string) {
    super(`${email} is already on this team`);
    this.name = 'AlreadyOnTheTeamError';
  }
}
