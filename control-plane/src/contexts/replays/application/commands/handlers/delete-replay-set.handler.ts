import type { DeleteReplaySetCommand } from '@replays/application/commands/delete-replay-set.command';
import type { SetDeleted } from '@replays/application/dto/replay-outcomes.dto';
import type { ReplaysAccess } from '@replays/application/services/replays-access.service';
import { UnknownReplaySetError } from '@replays/domain/exceptions/unknown-replay-set.error';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import { forbiddenTo } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';

export class DeleteReplaySetHandler
  implements CommandHandlerPort<DeleteReplaySetCommand, SetDeleted>
{
  constructor(
    private readonly access: ReplaysAccess,
    private readonly sets: ReplaySetRepository,
    private readonly replays: ReplayRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(command: DeleteReplaySetCommand): Promise<SetDeleted> {
    try {
      const clearance = await this.access.clearance(
        command.teamId,
        command.principal,
      );
      const set = await this.access.setOn(clearance, command.setId);

      if (!clearance.mayPlan) {
        return forbiddenTo('plan');
      }

      await this.transaction.run(async () => {
        const locked = await this.sets.locked(set.id);

        if (!locked) {
          throw new UnknownReplaySetError(command.setId);
        }

        const replays = await this.replays.ofSet(locked.id);

        await this.sets.save(
          locked.deleted(replays.some((each) => each.isUnderway)),
        );
      });

      return { outcome: 'deleted' };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
