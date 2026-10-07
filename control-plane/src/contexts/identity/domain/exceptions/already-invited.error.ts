export class AlreadyInvitedError extends Error {
  readonly violation = 'conflict' as const;

  constructor(email: string) {
    super(
      `An invite to ${email} was just sent for this team. Please try again.`,
    );
    this.name = 'AlreadyInvitedError';
  }
}
