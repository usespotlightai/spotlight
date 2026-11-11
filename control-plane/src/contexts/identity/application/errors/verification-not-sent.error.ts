import { ApplicationError } from '@shared-kernel/application/errors/application-error';

export class VerificationNotSentError extends ApplicationError {
  readonly kind = 'upstream-error' as const;

  constructor(email: string) {
    super(
      `Sorry, the verification email to ${email} could not be sent. Please resend it.`,
    );
    this.name = 'VerificationNotSentError';
  }
}
