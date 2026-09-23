import type { DeleteWorkspaceCommand } from '@identity/application/commands/delete-workspace.command';
import type { IdentityResourcesPort } from '@identity/application/ports/identity-resources.port';
import { WorkspaceInUseError } from '@identity/domain/exceptions/workspace-in-use.error';
import { WorkspaceMovedOnError } from '@identity/domain/exceptions/workspace-moved-on.error';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';
import { TeamKey } from '@identity/domain/value-objects/team-key.vo';
import type { ResourceDeleted } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class DeleteWorkspaceHandler
  implements CommandHandlerPort<DeleteWorkspaceCommand, ResourceDeleted | null>
{
  constructor(
    private readonly workspaces: WorkspaceRepository,
    private readonly resources: IdentityResourcesPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: DeleteWorkspaceCommand,
  ): Promise<ResourceDeleted | null> {
    const id = WorkspaceId.of(command.workspaceId);

    try {
      const standing = await this.workspaces.find(id);

      if (!standing?.administeredBy(UserId.of(command.requesterId))) {
        return null;
      }

      standing.expecting(command.expectedVersion);

      await this.transaction.run(async () => {
        const held = await this.resources.teamKeysIn(id);

        await this.workspaces.save(
          standing.closed(held.map((each) => TeamKey.of(each))),
        );
      });

      return { outcome: 'deleted' };
    } catch (error) {
      if (error instanceof WorkspaceMovedOnError) {
        const current = await this.workspaces.find(id);

        return current
          ? { outcome: 'moved-on', currentVersion: current.version }
          : null;
      }

      if (error instanceof WorkspaceInUseError) {
        return { outcome: 'in-use', reason: error.message };
      }

      rethrowAsFault(error);
    }
  }
}
