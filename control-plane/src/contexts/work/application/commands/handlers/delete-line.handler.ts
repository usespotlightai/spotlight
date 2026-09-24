import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import {
  FORBIDDEN,
  type ResourceDeleted,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { DeleteLineCommand } from '@work/application/commands/delete-line.command';
import type { StationTalliesPort } from '@work/application/ports/station-tallies.port';
import { LineInUseError } from '@work/domain/exceptions/line-in-use.error';
import { LineMovedOnError } from '@work/domain/exceptions/line-moved-on.error';
import { StrandedWorkError } from '@work/domain/exceptions/stranded-work.error';
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
      const standing = await this.lines.find(id);
      const membership = standing
        ? await this.access.onTeam(
            standing.teamId.value,
            UserId.of(command.requesterId),
          )
        : null;

      if (!standing || !membership) {
        return null;
      }

      if (!membership.administers) {
        return FORBIDDEN;
      }

      standing.expecting(command.expectedVersion);

      await this.transaction.run(async () => {
        const tasks = await this.tallies.lockedStandingAt(
          standing.stations.map((each) => each.id),
        );

        await this.lines.save(standing.retired(tasks));
      });

      return { outcome: 'deleted' };
    } catch (error) {
      if (error instanceof LineMovedOnError) {
        const current = await this.lines.find(id);

        return current
          ? { outcome: 'moved-on', currentVersion: current.version }
          : null;
      }

      if (
        error instanceof LineInUseError ||
        error instanceof StrandedWorkError
      ) {
        return { outcome: 'in-use', reason: error.message };
      }

      rethrowAsFault(error);
    }
  }
}
