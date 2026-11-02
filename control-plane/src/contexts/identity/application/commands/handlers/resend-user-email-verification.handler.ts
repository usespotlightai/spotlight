import type { ResendUserEmailVerificationCommand } from '@identity/application/commands/resend-user-email-verification.command';
import type { UserEmailDto } from '@identity/application/dto/user-email.dto';
import { userEmailDtoFrom } from '@identity/application/mappers/user-email.mapper';
import type { VerificationSending } from '@identity/application/services/verification-sending.service';
import type { UserEmailRepository } from '@identity/domain/repositories/user-email.repository';
import { EmailAddress } from '@identity/domain/value-objects/email-address.vo';
import { UserEmailId } from '@identity/domain/value-objects/user-email-id.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TokenIssuer } from '@shared-kernel/application/ports/token-issuer.port';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class ResendUserEmailVerificationHandler
  implements
    CommandHandlerPort<ResendUserEmailVerificationCommand, UserEmailDto | null>
{
  constructor(
    private readonly emails: UserEmailRepository,
    private readonly sending: VerificationSending,
    private readonly tokens: TokenIssuer,
    private readonly clock: ClockPort,
  ) {}

  async execute(
    command: ResendUserEmailVerificationCommand,
  ): Promise<UserEmailDto | null> {
    try {
      const found = await this.emails.ofUser(
        UserId.of(command.viewerId),
        UserEmailId.of(command.userEmailId),
      );

      if (!found) {
        return null;
      }

      const issued = this.tokens.issue();
      const now = this.clock.now();
      const resent = found.resend(TokenHash.of(issued.hash), now);

      await this.sending.send(
        resent,
        issued.token,
        EmailAddress.of(command.viewerEmail),
      );
      await this.emails.save(resent);

      return userEmailDtoFrom(resent, now);
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
