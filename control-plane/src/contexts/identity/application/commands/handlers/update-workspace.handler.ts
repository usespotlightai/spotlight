import type { UpdateWorkspaceCommand } from '@identity/application/commands/update-workspace.command';
import type { IdentityDefinitionsPort } from '@identity/application/ports/identity-definitions.port';
import { IdentityProblems } from '@identity/application/rendering/identity-problems';
import { WorkspaceSlugFixedError } from '@identity/domain/exceptions/workspace-slug-fixed.error';
import { WorkspaceVersionConflictError } from '@identity/domain/exceptions/workspace-version-conflict.error';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';
import {
  forbiddenTo,
  type ResourceUpdated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
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
      const existing = await this.workspaces.find(id);

      const permissions = existing?.permissionsFor(command.actor.principal);

      if (!existing || !permissions?.reads) {
        return null;
      }

      if (!permissions.configures) {
        return forbiddenTo('configure');
      }

      existing.assertVersion(command.expectedVersion);

      const compiled = this.definitions.workspace(command.definition);

      if (!compiled.ok) {
        return { outcome: 'invalid', problems: compiled.problems };
      }

      await this.transaction.inTransaction(() =>
        this.workspaces.save(
          existing.redefinedAs(compiled, Attribution.of(command.actor, id)),
        ),
      );

      return { outcome: 'updated', id: id.value };
    } catch (error) {
      if (error instanceof WorkspaceVersionConflictError) {
        const current = await this.workspaces.find(id);

        return current
          ? { outcome: 'version-conflict', currentVersion: current.version }
          : null;
      }

      if (error instanceof WorkspaceSlugFixedError) {
        return {
          outcome: 'invalid',
          problems: [IdentityProblems.slugFixed(error)],
        };
      }

      rethrowAsApplicationError(error);
    }
  }
}
