import type { RenameReplaySetCommand } from '@replays/application/commands/rename-replay-set.command';
import type { SetChanged } from '@replays/application/dto/replay-outcomes.dto';
import type { ReplaysAccess } from '@replays/application/services/replays-access.service';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import { ReplaySetName } from '@replays/domain/value-objects/replay-set-name.vo';
import { forbiddenTo } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';

export class RenameReplaySetHandler
  implements CommandHandlerPort<RenameReplaySetCommand, SetChanged>
{
  constructor(
    private readonly access: ReplaysAccess,
    private readonly sets: ReplaySetRepository,
  ) {}

  async execute(command: RenameReplaySetCommand): Promise<SetChanged> {
    try {
      const clearance = await this.access.clearance(
        command.teamId,
        command.principal,
      );
      const set = await this.access.setOn(clearance, command.setId);

      if (!clearance.mayPlan) {
        return forbiddenTo('plan');
      }

      const renamed = set.renamed(ReplaySetName.of(command.name));

      if (renamed !== set) {
        await this.sets.save(renamed);
      }

      return { outcome: 'changed' };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
