import type { RemoveReplaySetEntryCommand } from '@replays/application/commands/remove-replay-set-entry.command';
import type { SetChanged } from '@replays/application/dto/replay-outcomes.dto';
import type { ReplaysAccess } from '@replays/application/services/replays-access.service';
import { UnknownReplaySetError } from '@replays/domain/exceptions/unknown-replay-set.error';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import { forbiddenTo } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class RemoveReplaySetEntryHandler
  implements CommandHandlerPort<RemoveReplaySetEntryCommand, SetChanged>
{
  constructor(
    private readonly access: ReplaysAccess,
    private readonly sets: ReplaySetRepository,
    private readonly searches: SearchRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(command: RemoveReplaySetEntryCommand): Promise<SetChanged> {
    try {
      const access = await this.access.forTeam(
        command.teamId,
        command.principal,
      );
      const set = await this.access.setOn(access, command.setId);

      if (!access.mayPlan) {
        return forbiddenTo('plan');
      }

      await this.transaction.inTransaction(async () => {
        const locked = await this.sets.locked(set.id);

        if (!locked) {
          throw new UnknownReplaySetError(command.setId);
        }

        const searched = await this.searches.activeOfSet(locked.id);

        await this.sets.save(
          locked.withoutEntry(RunId.of(command.runId), searched !== null),
        );
      });

      return { outcome: 'changed' };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
