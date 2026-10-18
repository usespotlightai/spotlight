import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import {
  forbiddenTo,
  type ResourceDeleted,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import type { DeleteLineCommand } from '@work/application/commands/delete-line.command';
import type { StationTalliesPort } from '@work/application/ports/station-tallies.port';
import { LineInUseError } from '@work/domain/exceptions/line-in-use.error';
import { LineVersionConflictError } from '@work/domain/exceptions/line-version-conflict.error';
import { StationNotEmptyError } from '@work/domain/exceptions/station-not-empty.error';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import { LineId } from '@work/domain/value-objects/line-id.vo';

export class DeleteLineHandler
  implements CommandHandlerPort<DeleteLineCommand, ResourceDeleted | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly lines: LineRepository,
    private readonly tallies: StationTalliesPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(command: DeleteLineCommand): Promise<ResourceDeleted | null> {
    const id = LineId.of(command.lineId);

    try {
      const existing = await this.lines.find(id);
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

      await this.transaction.inTransaction(async () => {
        const tasks = await this.tallies.lockedTaskCountsAt(
          existing.stations.map((each) => each.id),
        );

        await this.lines.save(
          existing.delete(
            tasks,
            ChangeActor.of(command.actor, existing.workspaceId),
          ),
        );
      });

      return { outcome: 'deleted' };
    } catch (error) {
      if (error instanceof LineVersionConflictError) {
        const current = await this.lines.find(id);

        return current
          ? { outcome: 'version-conflict', currentVersion: current.version }
          : null;
      }

      if (
        error instanceof LineInUseError ||
        error instanceof StationNotEmptyError
      ) {
        return { outcome: 'in-use', reason: error.message };
      }

      rethrowAsApplicationError(error);
    }
  }
}
