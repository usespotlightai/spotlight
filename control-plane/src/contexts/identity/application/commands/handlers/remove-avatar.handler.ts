import type { RemoveAvatarCommand } from '@identity/application/commands/avatar.commands';
import type { AvatarOwners } from '@identity/application/services/avatar-owners.service';
import type { AvatarRepository } from '@identity/domain/repositories/avatar.repository';
import {
  forbiddenTo,
  type ResourceDeleted,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';

export class RemoveAvatarHandler implements CommandHandlerPort<
  RemoveAvatarCommand,
  ResourceDeleted | null
> {
  constructor(
    private readonly owners: AvatarOwners,
    private readonly avatars: AvatarRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(command: RemoveAvatarCommand): Promise<ResourceDeleted | null> {
    try {
      const owned = await this.owners.of(command.of, command.actor.principal);

      if (!owned) {
        return null;
      }

      if (!owned.permissions.configures) {
        return forbiddenTo('configure');
      }

      const existing = await this.avatars.find(owned.owner);

      if (existing) {
        await this.transaction.inTransaction(() =>
          this.avatars.save(existing.removed()),
        );
      }

      return { outcome: 'deleted' };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
