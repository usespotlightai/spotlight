import type { DeleteHarnessProfileCommand } from '@configuration/application/commands/delete-harness-profile.command';
import type { StationGifts } from '@configuration/application/services/station-gifts.service';
import { HarnessProfileInUseError } from '@configuration/domain/exceptions/harness-profile-in-use.error';
import { HarnessProfileVersionConflictError } from '@configuration/domain/exceptions/harness-profile-version-conflict.error';
import type { HarnessProfileRepository } from '@configuration/domain/repositories/harness-profile.repository';
import { HarnessProfileId } from '@configuration/domain/value-objects/harness-profile-id.vo';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import {
  forbiddenTo,
  type ResourceDeleted,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
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
    private readonly given: StationGifts,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: DeleteHarnessProfileCommand,
  ): Promise<ResourceDeleted | null> {
    const id = HarnessProfileId.of(command.profileId);

    try {
      const standing = await this.profiles.withId(id);
      const cleared = standing
        ? await this.access.clearanceOnTeam(
            standing.teamId.value,
            command.actor.principal,
          )
        : null;

      if (!standing || !cleared) {
        return null;
      }

      if (!cleared.configures) {
        return forbiddenTo('configure');
      }

      standing.assertVersion(command.expectedVersion);

      const named = await this.given.onTeam(standing.teamId, 'profile');

      await this.transaction.run(() =>
        this.profiles.save(
          standing.retired(
            named,
            Attribution.of(command.actor, cleared.workspaceId),
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

      rethrowAsFault(error);
    }
  }
}
