import type { VerifyUserEmailCommand } from '@identity/application/commands/verify-user-email.command';
import type { UserEmailDto } from '@identity/application/dto/user-email.dto';
import { userEmailDtoFrom } from '@identity/application/mappers/user-email.mapper';
import type { EmailOwnersPort } from '@identity/application/ports/email-owners.port';
import type { UserEmailRepository } from '@identity/domain/repositories/user-email.repository';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TokenIssuer } from '@shared-kernel/application/ports/token-issuer.port';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class VerifyUserEmailHandler implements CommandHandlerPort<
  VerifyUserEmailCommand,
  UserEmailDto | null
> {
  constructor(
    private readonly emails: UserEmailRepository,
    private readonly owners: EmailOwnersPort,
    private readonly tokens: TokenIssuer,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: VerifyUserEmailCommand): Promise<UserEmailDto | null> {
    try {
      const found = await this.emails.withToken(
        TokenHash.of(this.tokens.hash(command.token)),
      );

      if (!found) {
        return null;
      }

      const now = this.clock.now();
      const verified = found.verify({
        by: UserId.of(command.viewerId),
        owner: await this.owners.ownerOf(found.email),
        now,
      });

      if (verified !== found) {
        await this.emails.save(verified);
      }

      return userEmailDtoFrom(verified, now);
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
