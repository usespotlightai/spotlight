import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class SignInEmailNotAdditionalError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(email: string) {
    super(`${email} is your sign-in email. It is not an additional email.`);
    this.name = 'SignInEmailNotAdditionalError';
  }
}
