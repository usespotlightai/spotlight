export class NotYourInviteError extends Error {
  readonly violation = 'not-allowed' as const;

  constructor(readonly invited: string) {
    super(
      `This invite was sent to ${invited}. Please sign in as ${invited} to accept it.`,
    );
    this.name = 'NotYourInviteError';
  }
}
