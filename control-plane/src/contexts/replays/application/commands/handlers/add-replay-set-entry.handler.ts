import type { AddReplaySetEntryCommand } from '@replays/application/commands/add-replay-set-entry.command';
import type { SetChanged } from '@replays/application/dto/replay-outcomes.dto';
import type { WorkPort } from '@replays/application/ports/work.port';
import type { ReplaysAccess } from '@replays/application/services/replays-access.service';
import type { SetStations } from '@replays/application/services/set-stations.service';
import { UnknownReplaySetError } from '@replays/domain/exceptions/unknown-replay-set.error';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import { forbiddenTo } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class AddReplaySetEntryHandler
  implements CommandHandlerPort<AddReplaySetEntryCommand, SetChanged>
{
  constructor(
    private readonly access: ReplaysAccess,
    private readonly sets: ReplaySetRepository,
    private readonly searches: SearchRepository,
    private readonly work: WorkPort,
    private readonly clock: ClockPort,
    private readonly stations: SetStations,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(command: AddReplaySetEntryCommand): Promise<SetChanged> {
    try {
      const clearance = await this.access.clearance(
        command.teamId,
        command.principal,
      );
      const set = await this.access.setOn(clearance, command.setId);

      if (!clearance.mayPlan) {
        return forbiddenTo('plan');
      }

      await this.stations.stillThere(set);

      const run = RunId.of(command.runId);
      const [replayable] = await this.work.replayable(set.workspaceId, [run]);

      await this.transaction.run(async () => {
        const locked = await this.sets.locked(set.id);

        if (!locked) {
          throw new UnknownReplaySetError(command.setId);
        }

        const searched = await this.searches.activeOfSet(locked.id);

        await this.sets.save(
          locked.withEntry(
            replayable ?? {
              runId: run,
              taskId: null,
              stationId: null,
              refusal: 'unknown-run',
              reason: 'there is no such run',
            },
            this.clock.now(),
            searched !== null,
          ),
        );
      });

      return { outcome: 'changed' };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
