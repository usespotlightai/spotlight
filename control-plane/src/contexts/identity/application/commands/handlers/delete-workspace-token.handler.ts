import type { DeleteWorkspaceTokenCommand } from '@identity/application/commands/workspace-token.commands';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { WorkspaceTokenVersionConflictError } from '@identity/domain/exceptions/workspace-token-version-conflict.error';
import type { WorkspaceTokenRepository } from '@identity/domain/repositories/workspace-token.repository';
import {
  forbiddenTo,
  type ResourceDeleted,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { WorkspaceTokenId } from '@shared-kernel/domain/value-objects/workspace-token-id.vo';

export class DeleteWorkspaceTokenHandler
  implements
    CommandHandlerPort<DeleteWorkspaceTokenCommand, ResourceDeleted | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly tokens: WorkspaceTokenRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: DeleteWorkspaceTokenCommand,
  ): Promise<ResourceDeleted | null> {
    const id = WorkspaceTokenId.of(command.tokenId);

    try {
      const existing = await this.tokens.find(id);
      const permissions = existing
        ? await this.access.permissionsIn(
            existing.workspaceId,
            command.actor.principal,
          )
        : null;

      if (!existing || !permissions) {
        return null;
      }

      if (!permissions.administers) {
        return forbiddenTo('administer');
      }

      existing.assertVersion(command.expectedVersion);

      await this.transaction.inTransaction(() =>
        this.tokens.save(
          existing.revoke(Attribution.of(command.actor, existing.workspaceId)),
        ),
      );

      return { outcome: 'deleted' };
    } catch (error) {
      if (error instanceof WorkspaceTokenVersionConflictError) {
        const current = await this.tokens.find(id);

        return current
          ? { outcome: 'version-conflict', currentVersion: current.version }
          : null;
      }

      rethrowAsApplicationError(error);
    }
  }
}
