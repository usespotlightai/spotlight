import type { UserEmailMailPort } from '@identity/application/ports/user-email-mail.port';
import type { UserEmail } from '@identity/domain/aggregates/user-email.aggregate';
import type { EmailAddress } from '@identity/domain/value-objects/email-address.vo';
import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

export class VerificationSending {
  constructor(
    private readonly mail: UserEmailMailPort,
    private readonly logger: LoggerPort,
  ) {}

  async send(
    email: UserEmail,
    token: string,
    signInEmail: EmailAddress,
  ): Promise<void> {
    try {
      await this.mail.send({
        to: email.email.value,
        token,
        signInEmail: signInEmail.value,
      });
    } catch (error) {
      this.logger.warn(
        { err: error, userEmailId: email.id.value },
        'Could not send an email verification',
      );
      throw new ApplicationError(
        'upstream-error',
        `Sorry, the verification email to ${email.email.value} could not be sent. Please resend it.`,
      );
    }
  }
}
