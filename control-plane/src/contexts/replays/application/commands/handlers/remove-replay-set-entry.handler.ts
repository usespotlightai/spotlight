import type { RemoveReplaySetEntryCommand } from '@replays/application/commands/remove-replay-set-entry.command';
import type { SetChanged } from '@replays/application/dto/replay-outcomes.dto';
import type { ReplaysAccess } from '@replays/application/services/replays-access.service';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import { forbiddenTo } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class RemoveReplaySetEntryHandler
  implements CommandHandlerPort<RemoveReplaySetEntryCommand, SetChanged>
{
  constructor(
    private readonly access: ReplaysAccess,
    private readonly sets: ReplaySetRepository,
  ) {}

  async execute(command: RemoveReplaySetEntryCommand): Promise<SetChanged> {
    try {
      const clearance = await this.access.clearance(
        command.teamId,
        command.principal,
      );
      const set = await this.access.setOn(clearance, command.setId);

      if (!clearance.mayPlan) {
        return forbiddenTo('plan');
      }

      await this.sets.save(set.withoutEntry(RunId.of(command.runId)));

      return { outcome: 'changed' };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
