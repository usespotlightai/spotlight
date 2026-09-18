export class AlreadyInvitedError extends Error {
  readonly violation = 'conflict' as const;

  constructor(email: string) {
    super(`${email} has just been invited to this team. Try again`);
    this.name = 'AlreadyInvitedError';
  }
}
