import type { UpdateWorkspaceCommand } from '@identity/application/commands/update-workspace.command';
import type { IdentityDefinitionsPort } from '@identity/application/ports/identity-definitions.port';
import type { WorkspaceOutboundHostsPort } from '@identity/application/ports/workspace-outbound-hosts.port';
import {
  IdentityProblems,
  WORKSPACE,
} from '@identity/application/rendering/identity-problems';
import { WorkspaceVersionConflictError } from '@identity/domain/exceptions/workspace-version-conflict.error';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';
import {
  forbiddenTo,
  type ResourceUpdated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class UpdateWorkspaceHandler
  implements CommandHandlerPort<UpdateWorkspaceCommand, ResourceUpdated | null>
{
  constructor(
    private readonly definitions: IdentityDefinitionsPort,
    private readonly workspaces: WorkspaceRepository,
    private readonly transaction: TransactionPort,
    private readonly outboundHosts: WorkspaceOutboundHostsPort,
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

      const updated = existing.update(
        compiled,
        ChangeActor.of(command.actor, id),
      );

      if (updated !== existing) {
        await this.transaction.inTransaction(() =>
          this.workspaces.save(updated),
        );
        this.outboundHosts.forget(id.value);
      }

      return { outcome: 'updated', id: id.value };
    } catch (error) {
      if (error instanceof WorkspaceVersionConflictError) {
        const current = await this.workspaces.find(id);

        return current
          ? { outcome: 'version-conflict', currentVersion: current.version }
          : null;
      }

      if (error instanceof ImmutableFieldError) {
        return {
          outcome: 'invalid',
          problems: [IdentityProblems.immutableField(WORKSPACE, error)],
        };
      }

      rethrowAsApplicationError(error);
    }
  }
}
