export class NotATeamMemberError extends Error {
  readonly kind = 'invalid' as const;

  constructor() {
    super('Assignee is not a member of this team.');
    this.name = 'NotATeamMemberError';
  }
}
