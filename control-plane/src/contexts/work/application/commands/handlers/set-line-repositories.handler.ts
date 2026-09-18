import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { SetLineRepositoriesCommand } from '@work/application/commands/set-line-repositories.command';
import type { ProposedChangeDto } from '@work/application/dto/proposed-change.dto';
import type { ProposeLineChange } from '@work/application/services/propose-line-change.service';

export class SetLineRepositoriesHandler
  implements
    CommandHandlerPort<SetLineRepositoriesCommand, ProposedChangeDto | null>
{
  constructor(private readonly proposals: ProposeLineChange) {}

  async execute(
    command: SetLineRepositoriesCommand,
  ): Promise<ProposedChangeDto | null> {
    try {
      return await this.proposals.propose({
        teamId: command.teamId,
        viewerId: command.viewerId,
        lineId: command.lineId,
        change: (base) =>
          base.worksIn(command.repositories.map((each) => Repository.of(each))),
        describe: (edited) =>
          `Changes to the repositories the ${edited.name.value} line works in.`,
      });
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
