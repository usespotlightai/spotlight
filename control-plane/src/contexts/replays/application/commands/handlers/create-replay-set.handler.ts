import type { CreateReplaySetCommand } from '@replays/application/commands/create-replay-set.command';
import type { SetCreated } from '@replays/application/dto/replay-outcomes.dto';
import type { ReplaysAccess } from '@replays/application/services/replays-access.service';
import { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import { ReplaySetName } from '@replays/domain/value-objects/replay-set-name.vo';
import { forbiddenTo } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';

export class CreateReplaySetHandler
  implements CommandHandlerPort<CreateReplaySetCommand, SetCreated>
{
  constructor(
    private readonly access: ReplaysAccess,
    private readonly sets: ReplaySetRepository,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: CreateReplaySetCommand): Promise<SetCreated> {
    try {
      const access = await this.access.forTeam(
        command.teamId,
        command.principal,
      );
      const station = await this.access.stationOn(
        access,
        command.lineId,
        command.stationId,
      );

      if (!access.mayPlan) {
        return forbiddenTo('plan');
      }

      const created = ReplaySet.create({
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

      await this.sets.add(created);

      return { outcome: 'created', id: created.id.value };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
