import type { DeleteTeamCommand } from '@identity/application/commands/delete-team.command';
import type { TeamDependentsPort } from '@identity/application/ports/team-dependents.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { TeamInUseError } from '@identity/domain/exceptions/team-in-use.error';
import { TeamVersionConflictError } from '@identity/domain/exceptions/team-version-conflict.error';
import type { TeamRepository } from '@identity/domain/repositories/team.repository';
import { Dependents } from '@identity/domain/value-objects/dependents.vo';
import {
  forbiddenTo,
  type ResourceDeleted,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class DeleteTeamHandler
  implements CommandHandlerPort<DeleteTeamCommand, ResourceDeleted | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly teams: TeamRepository,
    private readonly dependents: TeamDependentsPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(command: DeleteTeamCommand): Promise<ResourceDeleted | null> {
    const id = TeamId.of(command.teamId);

    try {
      const existing = await this.teams.find(id);
      const permissions = existing
        ? await this.access.permissionsIn(
            existing.workspaceId,
            command.actor.principal,
          )
        : null;

      if (!existing || !permissions) {
        return null;
      }

      if (!permissions.configures) {
        return forbiddenTo('configure');
      }

      existing.assertVersion(command.expectedVersion);

      const remaining = Dependents.of(await this.dependents.of(id));

      await this.transaction.inTransaction(() =>
        this.teams.save(
          existing.disband(
            remaining,
            Attribution.of(command.actor, existing.workspaceId),
          ),
        ),
      );

      return { outcome: 'deleted' };
    } catch (error) {
      if (error instanceof TeamVersionConflictError) {
        const current = await this.teams.find(id);

        return current
          ? { outcome: 'version-conflict', currentVersion: current.version }
          : null;
      }

      if (error instanceof TeamInUseError) {
        return { outcome: 'in-use', reason: error.message };
      }

      rethrowAsApplicationError(error);
    }
  }
}
