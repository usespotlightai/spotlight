export class NotYoursToInviteError extends Error {
  readonly violation = 'not-allowed' as const;

  constructor() {
    super(
      'Nobody can be invited as an owner. Please invite them as an admin, then make them an owner.',
    );
    this.name = 'NotYoursToInviteError';
  }
}
