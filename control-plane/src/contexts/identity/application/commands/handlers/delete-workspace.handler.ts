import type { DeleteWorkspaceCommand } from '@identity/application/commands/delete-workspace.command';
import type { IdentityResourcesPort } from '@identity/application/ports/identity-resources.port';
import type { WorkspaceDependentsPort } from '@identity/application/ports/workspace-dependents.port';
import { WorkspaceInUseError } from '@identity/domain/exceptions/workspace-in-use.error';
import { WorkspaceVersionConflictError } from '@identity/domain/exceptions/workspace-version-conflict.error';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';
import { Dependents } from '@identity/domain/value-objects/dependents.vo';
import { TeamKey } from '@identity/domain/value-objects/team-key.vo';
import { TokenName } from '@identity/domain/value-objects/token-name.vo';
import { TokenTrustKey } from '@identity/domain/value-objects/token-trust-key.vo';
import {
  forbiddenTo,
  type ResourceDeleted,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class DeleteWorkspaceHandler
  implements CommandHandlerPort<DeleteWorkspaceCommand, ResourceDeleted | null>
{
  constructor(
    private readonly workspaces: WorkspaceRepository,
    private readonly resources: IdentityResourcesPort,
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

      if (!permissions.administers) {
        return forbiddenTo('administer');
      }

      existing.assertVersion(command.expectedVersion);

      const remaining = Dependents.of(await this.dependents.of(id));

      await this.transaction.inTransaction(async () => {
        const teams = await this.resources.teamKeysIn(id);
        const tokens = await this.resources.tokenNamesIn(id);
        const trusts = await this.resources.tokenTrustKeysIn(id);
        const minting = await this.resources.mintingTrustKeysIn(id);

        await this.workspaces.save(
          existing.close(
            teams.map((each) => TeamKey.of(each)),
            tokens.map((each) => TokenName.of(each)),
            trusts.map((each) => TokenTrustKey.of(each)),
            minting.map((each) => TokenTrustKey.of(each)),
            remaining,
            Attribution.of(command.actor, id),
          ),
        );
      });

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
