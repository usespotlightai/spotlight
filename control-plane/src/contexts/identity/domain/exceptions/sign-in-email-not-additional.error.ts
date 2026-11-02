export class SignInEmailNotAdditionalError extends Error {
  readonly kind = 'invalid' as const;

  constructor(email: string) {
    super(`${email} is your sign-in email. It is not an additional email.`);
    this.name = 'SignInEmailNotAdditionalError';
  }
}
