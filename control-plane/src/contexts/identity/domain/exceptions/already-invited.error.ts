export class AlreadyInvitedError extends Error {
  readonly kind = 'conflict' as const;

  constructor(email: string) {
    super(
      `An invite to ${email} was just sent for this workspace. Please try again.`,
    );
    this.name = 'AlreadyInvitedError';
  }
}
