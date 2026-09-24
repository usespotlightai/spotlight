import type { UpdateWorkspaceCommand } from '@identity/application/commands/update-workspace.command';
import type { IdentityDefinitionsPort } from '@identity/application/ports/identity-definitions.port';
import { IdentityProblems } from '@identity/application/rendering/identity-problems';
import { WorkspaceMovedOnError } from '@identity/domain/exceptions/workspace-moved-on.error';
import { WorkspaceSlugFixedError } from '@identity/domain/exceptions/workspace-slug-fixed.error';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';
import {
  FORBIDDEN,
  type ResourceUpdated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class UpdateWorkspaceHandler
  implements CommandHandlerPort<UpdateWorkspaceCommand, ResourceUpdated | null>
{
  constructor(
    private readonly definitions: IdentityDefinitionsPort,
    private readonly workspaces: WorkspaceRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: UpdateWorkspaceCommand,
  ): Promise<ResourceUpdated | null> {
    const id = WorkspaceId.of(command.workspaceId);

    try {
      const standing = await this.workspaces.find(id);

      const requester = UserId.of(command.requesterId);

      if (!standing?.holds(requester)) {
        return null;
      }

      if (!standing.administeredBy(requester)) {
        return FORBIDDEN;
      }

      standing.expecting(command.expectedVersion);

      const compiled = this.definitions.workspace(command.definition);

      if (!compiled.ok) {
        return { outcome: 'invalid', problems: compiled.problems };
      }

      await this.transaction.run(() =>
        this.workspaces.save(standing.redefinedAs(compiled)),
      );

      return { outcome: 'updated', id: id.value };
    } catch (error) {
      if (error instanceof WorkspaceMovedOnError) {
        const current = await this.workspaces.find(id);

        return current
          ? { outcome: 'moved-on', currentVersion: current.version }
          : null;
      }

      if (error instanceof WorkspaceSlugFixedError) {
        return {
          outcome: 'invalid',
          problems: [IdentityProblems.slugFixed(error)],
        };
      }

      rethrowAsFault(error);
    }
  }
}
