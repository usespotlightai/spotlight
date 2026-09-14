import type { SetLineRepositoriesCommand } from '@application/commands/set-line-repositories.command';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { OpenedPullRequestDto } from '@application/ports/pull-request.port';
import type { ProposeConfigurationChange } from '@application/services/propose-configuration-change.service';
import { Repository } from '@domain/value-objects/repository.vo';

export class SetLineRepositoriesHandler
  implements
    CommandHandlerPort<SetLineRepositoriesCommand, OpenedPullRequestDto | null>
{
  constructor(private readonly proposals: ProposeConfigurationChange) {}

  async execute(
    command: SetLineRepositoriesCommand,
  ): Promise<OpenedPullRequestDto | null> {
    try {
      return await this.proposals.proposeLine({
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
