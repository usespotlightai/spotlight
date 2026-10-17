import type { DeleteHarnessProfileCommand } from '@configuration/application/commands/delete-harness-profile.command';
import type { StationReferences } from '@configuration/application/services/station-references.service';
import { HarnessProfileInUseError } from '@configuration/domain/exceptions/harness-profile-in-use.error';
import { HarnessProfileVersionConflictError } from '@configuration/domain/exceptions/harness-profile-version-conflict.error';
import type { HarnessProfileRepository } from '@configuration/domain/repositories/harness-profile.repository';
import { HarnessProfileId } from '@configuration/domain/value-objects/harness-profile-id.vo';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import {
  forbiddenTo,
  type ResourceDeleted,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';

export class DeleteHarnessProfileHandler
  implements
    CommandHandlerPort<DeleteHarnessProfileCommand, ResourceDeleted | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly profiles: HarnessProfileRepository,
    private readonly stationReferences: StationReferences,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: DeleteHarnessProfileCommand,
  ): Promise<ResourceDeleted | null> {
    const id = HarnessProfileId.of(command.profileId);

    try {
      const existing = await this.profiles.withId(id);
      const permissions = existing
        ? await this.access.permissionsOnTeam(
            existing.teamId.value,
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

      const named = await this.stationReferences.onTeam(
        existing.teamId,
        'profile',
      );

      await this.transaction.inTransaction(() =>
        this.profiles.save(
          existing.delete(
            named,
            Attribution.of(command.actor, permissions.workspaceId),
          ),
        ),
      );

      return { outcome: 'deleted' };
    } catch (error) {
      if (error instanceof HarnessProfileVersionConflictError) {
        const current = await this.profiles.withId(id);

        return current
          ? { outcome: 'version-conflict', currentVersion: current.version }
          : null;
      }

      if (error instanceof HarnessProfileInUseError) {
        return { outcome: 'in-use', reason: error.message };
      }

      rethrowAsApplicationError(error);
    }
  }
}
