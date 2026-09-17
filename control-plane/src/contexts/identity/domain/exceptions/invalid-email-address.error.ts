export class InvalidEmailAddressError extends Error {
  readonly violation = 'invalid' as const;

  constructor(raw: string) {
    super(`That is not an email address an invite could be sent to: ${raw}`);
    this.name = 'InvalidEmailAddressError';
  }
}
