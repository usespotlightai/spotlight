import type { StopReplayCommand } from '@replays/application/commands/stop-replay.command';
import type { ReplayStoppedOutcome } from '@replays/application/dto/replay-outcomes.dto';
import type { ReplaysAccess } from '@replays/application/services/replays-access.service';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import { forbiddenTo } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';

export class StopReplayHandler
  implements CommandHandlerPort<StopReplayCommand, ReplayStoppedOutcome>
{
  constructor(
    private readonly access: ReplaysAccess,
    private readonly replays: ReplayRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: StopReplayCommand): Promise<ReplayStoppedOutcome> {
    try {
      const clearance = await this.access.clearance(
        command.teamId,
        command.actor.principal,
      );
      const replay = await this.access.replayOn(clearance, command.replayId);

      if (!clearance.mayPlan) {
        return forbiddenTo('plan');
      }

      await this.replays.save(
        replay.stopped(
          this.clock.now(),
          Attribution.of(command.actor, replay.workspaceId),
        ),
      );

      return { outcome: 'stopped' };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
