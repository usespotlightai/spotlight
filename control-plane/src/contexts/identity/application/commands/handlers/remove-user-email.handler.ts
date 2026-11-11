import type { RemoveUserEmailCommand } from '@identity/application/commands/remove-user-email.command';
import type { UserEmailRepository } from '@identity/domain/repositories/user-email.repository';
import { UserEmailId } from '@identity/domain/value-objects/user-email-id.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class RemoveUserEmailHandler implements CommandHandlerPort<
  RemoveUserEmailCommand,
  boolean
> {
  constructor(private readonly emails: UserEmailRepository) {}

  async execute(command: RemoveUserEmailCommand): Promise<boolean> {
    try {
      const found = await this.emails.ofUser(
        UserId.of(command.viewerId),
        UserEmailId.of(command.userEmailId),
      );

      if (!found) {
        return false;
      }

      await this.emails.remove(found.remove());

      return true;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
