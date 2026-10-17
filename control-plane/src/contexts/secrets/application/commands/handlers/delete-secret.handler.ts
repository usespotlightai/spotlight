import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { DeleteSecretCommand } from '@secrets/application/commands/delete-secret.command';
import type { SecretUsesPort } from '@secrets/application/ports/secret-uses.port';
import { SecretInUseError } from '@secrets/domain/exceptions/secret-in-use.error';
import { SecretVersionConflictError } from '@secrets/domain/exceptions/secret-version-conflict.error';
import type { SecretRepository } from '@secrets/domain/repositories/secret.repository';
import { SecretId } from '@secrets/domain/value-objects/secret-id.vo';
import { SecretUses } from '@secrets/domain/value-objects/secret-uses.vo';
import {
  forbiddenTo,
  type ResourceDeleted,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
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
      const existing = await this.secrets.withId(id);
      const permissions = existing
        ? await this.access.permissionsIn(
            existing.workspaceId,
            command.actor.principal,
          )
        : null;

      if (!existing || !permissions) {
        return null;
      }

      if (!permissions.managesSecrets) {
        return forbiddenTo('manage-secrets');
      }

      existing.assertVersion(command.expectedVersion);

      const uses = SecretUses.of(
        await this.uses.of({
          workspaceId: existing.workspaceId.value,
          name: existing.name.value,
        }),
      );

      await this.transaction.inTransaction(() =>
        this.secrets.save(
          existing.deleted(
            uses,
            Attribution.of(command.actor, existing.workspaceId),
          ),
        ),
      );

      return { outcome: 'deleted' };
    } catch (error) {
      if (error instanceof SecretVersionConflictError) {
        const current = await this.secrets.withId(id);

        return current
          ? { outcome: 'version-conflict', currentVersion: current.version }
          : null;
      }

      if (error instanceof SecretInUseError) {
        return { outcome: 'in-use', reason: error.message };
      }

      rethrowAsApplicationError(error);
    }
  }
}
