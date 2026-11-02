import type { AddUserEmailCommand } from '@identity/application/commands/add-user-email.command';
import type { UserEmailDto } from '@identity/application/dto/user-email.dto';
import { userEmailDtoFrom } from '@identity/application/mappers/user-email.mapper';
import type { VerificationSending } from '@identity/application/services/verification-sending.service';
import { UserEmail } from '@identity/domain/aggregates/user-email.aggregate';
import type { UserEmailRepository } from '@identity/domain/repositories/user-email.repository';
import { EmailAddress } from '@identity/domain/value-objects/email-address.vo';
import { UserEmailId } from '@identity/domain/value-objects/user-email-id.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TokenIssuer } from '@shared-kernel/application/ports/token-issuer.port';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class AddUserEmailHandler
  implements CommandHandlerPort<AddUserEmailCommand, UserEmailDto>
{
  constructor(
    private readonly emails: UserEmailRepository,
    private readonly sending: VerificationSending,
    private readonly tokens: TokenIssuer,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: AddUserEmailCommand): Promise<UserEmailDto> {
    try {
      const userId = UserId.of(command.viewerId);
      const email = EmailAddress.of(command.email);
      const signInEmail = EmailAddress.of(command.viewerEmail);
      const issued = this.tokens.issue();
      const tokenHash = TokenHash.of(issued.hash);
      const now = this.clock.now();
      const existing = await this.emails.ofUserByAddress(userId, email);

      const written = existing
        ? existing.resend(tokenHash, now)
        : UserEmail.add({
            id: UserEmailId.of(this.ids.generate()),
            userId,
            email,
            signInEmail,
            held: await this.emails.countOfUser(userId),
            tokenHash,
            now,
          });

      await this.sending.send(written, issued.token, signInEmail);
      await (existing ? this.emails.save(written) : this.emails.add(written));

      return userEmailDtoFrom(written, now);
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
