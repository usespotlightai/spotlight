import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { DeleteSecretCommand } from '@secrets/application/commands/delete-secret.command';
import type { SecretUsesPort } from '@secrets/application/ports/secret-uses.port';
import { SecretInUseError } from '@secrets/domain/exceptions/secret-in-use.error';
import { SecretMovedOnError } from '@secrets/domain/exceptions/secret-moved-on.error';
import type { SecretRepository } from '@secrets/domain/repositories/secret.repository';
import { SecretId } from '@secrets/domain/value-objects/secret-id.vo';
import { SecretUses } from '@secrets/domain/value-objects/secret-uses.vo';
import {
  forbiddenTo,
  type ResourceDeleted,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';

export class DeleteSecretHandler
  implements CommandHandlerPort<DeleteSecretCommand, ResourceDeleted | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly secrets: SecretRepository,
    private readonly uses: SecretUsesPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(command: DeleteSecretCommand): Promise<ResourceDeleted | null> {
    const id = SecretId.of(command.secretId);

    try {
      const standing = await this.secrets.withId(id);
      const cleared = standing
        ? await this.access.clearanceIn(
            standing.workspaceId,
            command.actor.principal,
          )
        : null;

      if (!standing || !cleared) {
        return null;
      }

      if (!cleared.managesSecrets) {
        return forbiddenTo('manage-secrets');
      }

      standing.expecting(command.expectedVersion);

      const uses = SecretUses.of(
        await this.uses.of({
          workspaceId: standing.workspaceId.value,
          name: standing.name.value,
        }),
      );

      await this.transaction.run(() =>
        this.secrets.save(
          standing.deleted(
            uses,
            Attribution.of(command.actor, standing.workspaceId),
          ),
        ),
      );

      return { outcome: 'deleted' };
    } catch (error) {
      if (error instanceof SecretMovedOnError) {
        const current = await this.secrets.withId(id);

        return current
          ? { outcome: 'moved-on', currentVersion: current.version }
          : null;
      }

      if (error instanceof SecretInUseError) {
        return { outcome: 'in-use', reason: error.message };
      }

      rethrowAsFault(error);
    }
  }
}
