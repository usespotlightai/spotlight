import type { ReadConfigurationCommand } from '@configuration/application/commands/read-configuration.command';
import type { TeamsPort } from '@configuration/application/ports/teams.port';
import type {
  Read,
  ReadConfiguration,
} from '@configuration/application/services/read-configuration.service';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class ReadConfigurationHandler
  implements CommandHandlerPort<ReadConfigurationCommand, Read | null>
{
  constructor(
    private readonly teams: TeamsPort,
    private readonly reading: ReadConfiguration,
  ) {}

  async execute(command: ReadConfigurationCommand): Promise<Read | null> {
    try {
      const team = await this.teams.viewedBy(
        command.teamId,
        UserId.of(command.viewerId),
      );

      return team ? await this.reading.read(team) : null;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
