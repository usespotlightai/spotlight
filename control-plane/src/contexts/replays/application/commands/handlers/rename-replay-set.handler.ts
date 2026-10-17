import type { RenameReplaySetCommand } from '@replays/application/commands/rename-replay-set.command';
import type { SetChanged } from '@replays/application/dto/replay-outcomes.dto';
import type { ReplaysAccess } from '@replays/application/services/replays-access.service';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import { ReplaySetName } from '@replays/domain/value-objects/replay-set-name.vo';
import { forbiddenTo } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
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
      const access = await this.access.forTeam(
        command.teamId,
        command.principal,
      );
      const set = await this.access.setOn(access, command.setId);

      if (!access.mayPlan) {
        return forbiddenTo('plan');
      }

      const renamed = set.rename(ReplaySetName.of(command.name));

      if (renamed !== set) {
        await this.sets.save(renamed);
      }

      return { outcome: 'changed' };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
