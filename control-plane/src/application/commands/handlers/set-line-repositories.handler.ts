import type { SetLineRepositoriesCommand } from '@application/commands/set-line-repositories.command';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { OpenedPullRequestDto } from '@application/ports/pull-request.port';
import type { ProposeLineChange } from '@application/services/propose-line-change.service';
import { Repository } from '@domain/value-objects/repository.vo';

/** A change to the line's repositories, proposed to the configuration
 *  repository as a pull request. */
export class SetLineRepositoriesHandler
  implements
    CommandHandlerPort<SetLineRepositoriesCommand, OpenedPullRequestDto | null>
{
  constructor(private readonly proposals: ProposeLineChange) {}

  async execute(
    command: SetLineRepositoriesCommand,
  ): Promise<OpenedPullRequestDto | null> {
    try {
      return await this.proposals.propose({
        teamId: command.teamId,
        viewerId: command.viewerId,
        lineId: command.lineId,
        change: (base) =>
          base.worksIn(command.repositories.map((each) => Repository.of(each))),
        describe: (edited) => ({
          title: 'Update Spotlight configuration',
          body: [
            `Changes to the repositories the ${edited.name.value} line works in.`,
            'The board changes when this is merged and read back — nothing here takes effect on its own.',
          ].join('\n\n'),
        }),
      });
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
