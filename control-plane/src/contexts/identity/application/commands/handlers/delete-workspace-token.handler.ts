import type { DeleteWorkspaceTokenCommand } from '@identity/application/commands/workspace-token.commands';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { WorkspaceTokenMovedOnError } from '@identity/domain/exceptions/workspace-token-moved-on.error';
import type { WorkspaceTokenRepository } from '@identity/domain/repositories/workspace-token.repository';
import {
  forbiddenTo,
  type ResourceDeleted,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
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
      const found = await this.tokens.find(id);
      const standing = found?.isMinted ? null : found;
      const cleared = standing
        ? await this.access.clearanceIn(
            standing.workspaceId,
            command.actor.principal,
          )
        : null;

      if (!standing || !cleared) {
        return null;
      }

      if (!cleared.administers) {
        return forbiddenTo('administer');
      }

      standing.expecting(command.expectedVersion);

      await this.transaction.run(() =>
        this.tokens.save(
          standing.revoked(Attribution.of(command.actor, standing.workspaceId)),
        ),
      );

      return { outcome: 'deleted' };
    } catch (error) {
      if (error instanceof WorkspaceTokenMovedOnError) {
        const current = await this.tokens.find(id);

        return current
          ? { outcome: 'moved-on', currentVersion: current.version }
          : null;
      }

      rethrowAsFault(error);
    }
  }
}
