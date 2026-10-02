import type { AddReplaySetEntryCommand } from '@replays/application/commands/add-replay-set-entry.command';
import type { SetChanged } from '@replays/application/dto/replay-outcomes.dto';
import type { WorkPort } from '@replays/application/ports/work.port';
import type { ReplaysAccess } from '@replays/application/services/replays-access.service';
import type { SetStations } from '@replays/application/services/set-stations.service';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import { forbiddenTo } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class AddReplaySetEntryHandler
  implements CommandHandlerPort<AddReplaySetEntryCommand, SetChanged>
{
  constructor(
    private readonly access: ReplaysAccess,
    private readonly sets: ReplaySetRepository,
    private readonly work: WorkPort,
    private readonly clock: ClockPort,
    private readonly stations: SetStations,
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

      await this.sets.save(
        set.withEntry(
          replayable ?? {
            runId: run,
            taskId: null,
            stationId: null,
            refusal: 'unknown-run',
            reason: 'there is no such run',
          },
          this.clock.now(),
        ),
      );

      return { outcome: 'changed' };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
