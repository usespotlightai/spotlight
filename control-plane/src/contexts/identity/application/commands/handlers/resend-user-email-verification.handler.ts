import type { ResendUserEmailVerificationCommand } from '@identity/application/commands/resend-user-email-verification.command';
import type { UserEmailDto } from '@identity/application/dto/user-email.dto';
import { userEmailDtoFrom } from '@identity/application/mappers/user-email.mapper';
import type { VerificationSendsPort } from '@identity/application/ports/verification-sends.port';
import type { VerificationSending } from '@identity/application/services/verification-sending.service';
import { UserEmail } from '@identity/domain/aggregates/user-email.aggregate';
import type { UserEmailRepository } from '@identity/domain/repositories/user-email.repository';
import { EmailAddress } from '@identity/domain/value-objects/email-address.vo';
import { UserEmailId } from '@identity/domain/value-objects/user-email-id.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TokenIssuer } from '@shared-kernel/application/ports/token-issuer.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class ResendUserEmailVerificationHandler implements CommandHandlerPort<
  ResendUserEmailVerificationCommand,
  UserEmailDto | null
> {
  constructor(
    private readonly emails: UserEmailRepository,
    private readonly sends: VerificationSendsPort,
    private readonly sending: VerificationSending,
    private readonly tokens: TokenIssuer,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: ResendUserEmailVerificationCommand,
  ): Promise<UserEmailDto | null> {
    try {
      const userId = UserId.of(command.viewerId);
      const issued = this.tokens.issue();
      const now = this.clock.now();

      const resent = await this.transaction.inTransaction(async () => {
        const sentInLastHour = await this.sends.lockAndCountSince(
          userId,
          UserEmail.sendsCountedSince(now),
        );
        const found = await this.emails.ofUser(
          userId,
          UserEmailId.of(command.userEmailId),
        );

        if (!found) {
          return null;
        }

        const next = found.resend(
          TokenHash.of(issued.hash),
          now,
          sentInLastHour,
        );

        await this.emails.save(next);
        await this.sends.record(userId, now);

        return next;
      });

      if (!resent) {
        return null;
      }

      await this.sending.send(
        resent,
        issued.token,
        EmailAddress.of(command.viewerEmail),
      );

      return userEmailDtoFrom(resent, now);
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
