import type { OpenReplaySetCommand } from '@replays/application/commands/open-replay-set.command';
import type { SetOpened } from '@replays/application/dto/replay-outcomes.dto';
import type { ReplaysAccess } from '@replays/application/services/replays-access.service';
import { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import { ReplaySetName } from '@replays/domain/value-objects/replay-set-name.vo';
import { forbiddenTo } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';

export class OpenReplaySetHandler
  implements CommandHandlerPort<OpenReplaySetCommand, SetOpened>
{
  constructor(
    private readonly access: ReplaysAccess,
    private readonly sets: ReplaySetRepository,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: OpenReplaySetCommand): Promise<SetOpened> {
    try {
      const clearance = await this.access.clearance(
        command.teamId,
        command.principal,
      );
      const station = await this.access.stationOn(
        clearance,
        command.lineId,
        command.stationId,
      );

      if (!clearance.mayPlan) {
        return forbiddenTo('plan');
      }

      const opened = ReplaySet.opened({
        id: ReplaySetId.of(this.ids.generate()),
        station: {
          workspaceId: station.workspaceId,
          teamId: station.teamId,
          lineId: station.lineId,
          stationId: station.stationId,
        },
        name: ReplaySetName.of(command.name),
        at: this.clock.now(),
      });

      await this.sets.add(opened);

      return { outcome: 'opened', id: opened.id.value };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
