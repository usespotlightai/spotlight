export class NotYourInviteError extends Error {
  readonly violation = 'not-allowed' as const;

  constructor(readonly invited: string) {
    super(`This invite was sent to ${invited}. Sign in as them to accept it`);
    this.name = 'NotYourInviteError';
  }
}
