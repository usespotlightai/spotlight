import type { DeleteWorkspaceTokenTrustCommand } from '@identity/application/commands/workspace-token-trust.commands';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { TokenTrustBeyondGrantorError } from '@identity/domain/exceptions/token-trust-beyond-grantor.error';
import { TokenTrustVersionConflictError } from '@identity/domain/exceptions/token-trust-version-conflict.error';
import type { WorkspaceTokenTrustRepository } from '@identity/domain/repositories/workspace-token-trust.repository';
import { Grantor } from '@identity/domain/value-objects/grantor.vo';
import {
  forbiddenTo,
  type ResourceDeleted,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { WorkspaceTokenTrustId } from '@shared-kernel/domain/value-objects/workspace-token-trust-id.vo';

export class DeleteWorkspaceTokenTrustHandler
  implements
    CommandHandlerPort<DeleteWorkspaceTokenTrustCommand, ResourceDeleted | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly trusts: WorkspaceTokenTrustRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: DeleteWorkspaceTokenTrustCommand,
  ): Promise<ResourceDeleted | null> {
    const id = WorkspaceTokenTrustId.of(command.trustId);

    try {
      const standing = await this.trusts.find(id);
      const cleared = standing
        ? await this.access.clearanceIn(
            standing.workspaceId,
            command.actor.principal,
          )
        : null;

      if (!standing || !cleared) {
        return null;
      }

      if (!cleared.managesTokenTrusts) {
        return forbiddenTo('manage-token-trusts');
      }

      standing.assertVersion(command.expectedVersion);

      await this.transaction.run(() =>
        this.trusts.save(
          standing.withdrawn(
            Grantor.of(command.actor.principal),
            Attribution.of(command.actor, cleared.workspaceId),
          ),
        ),
      );

      return { outcome: 'deleted' };
    } catch (error) {
      if (error instanceof TokenTrustVersionConflictError) {
        const current = await this.trusts.find(id);

        return current
          ? { outcome: 'version-conflict', currentVersion: current.version }
          : null;
      }

      if (error instanceof TokenTrustBeyondGrantorError) {
        return forbiddenTo('manage-token-trusts');
      }

      rethrowAsFault(error);
    }
  }
}
