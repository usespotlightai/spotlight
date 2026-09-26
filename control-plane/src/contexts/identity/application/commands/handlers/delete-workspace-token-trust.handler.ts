import type { DeleteWorkspaceTokenTrustCommand } from '@identity/application/commands/workspace-token-trust.commands';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { TokenTrustMovedOnError } from '@identity/domain/exceptions/token-trust-moved-on.error';
import type { WorkspaceTokenTrustRepository } from '@identity/domain/repositories/workspace-token-trust.repository';
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

      standing.expecting(command.expectedVersion);

      await this.transaction.run(() =>
        this.trusts.save(
          standing.withdrawn(
            Attribution.of(command.actor, cleared.workspaceId),
          ),
        ),
      );

      return { outcome: 'deleted' };
    } catch (error) {
      if (error instanceof TokenTrustMovedOnError) {
        const current = await this.trusts.find(id);

        return current
          ? { outcome: 'moved-on', currentVersion: current.version }
          : null;
      }

      rethrowAsFault(error);
    }
  }
}
