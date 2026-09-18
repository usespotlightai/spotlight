export class NotATeamMemberError extends Error {
  readonly violation = 'invalid' as const;

  constructor() {
    super('That person is not on this team, so work cannot be given to them');
    this.name = 'NotATeamMemberError';
  }
}
