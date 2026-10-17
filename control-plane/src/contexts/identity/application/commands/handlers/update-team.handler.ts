import type { UpdateTeamCommand } from '@identity/application/commands/update-team.command';
import type { IdentityDefinitionsPort } from '@identity/application/ports/identity-definitions.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { IdentityProblems } from '@identity/application/rendering/identity-problems';
import { TeamKeyFixedError } from '@identity/domain/exceptions/team-key-fixed.error';
import { TeamVersionConflictError } from '@identity/domain/exceptions/team-version-conflict.error';
import type { TeamRepository } from '@identity/domain/repositories/team.repository';
import {
  forbiddenTo,
  type ResourceUpdated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class UpdateTeamHandler
  implements CommandHandlerPort<UpdateTeamCommand, ResourceUpdated | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly definitions: IdentityDefinitionsPort,
    private readonly teams: TeamRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(command: UpdateTeamCommand): Promise<ResourceUpdated | null> {
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

      const compiled = this.definitions.team(command.definition);

      if (!compiled.ok) {
        return { outcome: 'invalid', problems: compiled.problems };
      }

      await this.transaction.inTransaction(() =>
        this.teams.save(
          existing.redefinedAs(
            compiled,
            Attribution.of(command.actor, existing.workspaceId),
          ),
        ),
      );

      return { outcome: 'updated', id: id.value };
    } catch (error) {
      if (error instanceof TeamVersionConflictError) {
        const current = await this.teams.find(id);

        return current
          ? { outcome: 'version-conflict', currentVersion: current.version }
          : null;
      }

      if (error instanceof TeamKeyFixedError) {
        return {
          outcome: 'invalid',
          problems: [IdentityProblems.keyFixed(error)],
        };
      }

      rethrowAsApplicationError(error);
    }
  }
}
