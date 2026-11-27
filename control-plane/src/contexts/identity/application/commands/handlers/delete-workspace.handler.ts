import type { DeleteWorkspaceCommand } from '@identity/application/commands/delete-workspace.command';
import type { WorkspaceDependentsPort } from '@identity/application/ports/workspace-dependents.port';
import { WorkspaceInUseError } from '@identity/domain/exceptions/workspace-in-use.error';
import { WorkspaceVersionConflictError } from '@identity/domain/exceptions/workspace-version-conflict.error';
import type { OidcTrustRepository } from '@identity/domain/repositories/oidc-trust.repository';
import type { TeamRepository } from '@identity/domain/repositories/team.repository';
import type { WorkspaceTokenRepository } from '@identity/domain/repositories/workspace-token.repository';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';
import { dependentsInWorkspace } from '@identity/domain/services/workspace-contents';
import { Dependents } from '@identity/domain/value-objects/dependents.vo';
import {
  forbiddenTo,
  type ResourceDeleted,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class DeleteWorkspaceHandler implements CommandHandlerPort<
  DeleteWorkspaceCommand,
  ResourceDeleted | null
> {
  constructor(
    private readonly workspaces: WorkspaceRepository,
    private readonly teams: TeamRepository,
    private readonly tokens: WorkspaceTokenRepository,
    private readonly trusts: OidcTrustRepository,
    private readonly dependents: WorkspaceDependentsPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: DeleteWorkspaceCommand,
  ): Promise<ResourceDeleted | null> {
    const id = WorkspaceId.of(command.workspaceId);

    try {
      const existing = await this.workspaces.find(id);

      const permissions = existing?.permissionsFor(command.actor.principal);

      if (!existing || !permissions?.reads) {
        return null;
      }

      if (!permissions.isAdmin) {
        return forbiddenTo('administer');
      }

      existing.assertVersion(command.expectedVersion);

      const elsewhere = Dependents.of(await this.dependents.of(id));

      await this.transaction.inTransaction(async () =>
        this.workspaces.save(
          existing.delete(
            dependentsInWorkspace({
              teams: await this.teams.ofWorkspace(id),
              tokens: await this.tokens.ofWorkspace(id),
              trusts: await this.trusts.ofWorkspace(id),
            }).and(elsewhere),
            ChangeActor.of(command.actor, id),
          ),
        ),
      );

      return { outcome: 'deleted' };
    } catch (error) {
      if (error instanceof WorkspaceVersionConflictError) {
        const current = await this.workspaces.find(id);

        return current
          ? { outcome: 'version-conflict', currentVersion: current.version }
          : null;
      }

      if (error instanceof WorkspaceInUseError) {
        return { outcome: 'in-use', reason: error.message };
      }

      rethrowAsApplicationError(error);
    }
  }
}
