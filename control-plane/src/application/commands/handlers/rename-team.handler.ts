import type { RenameTeamCommand } from '@application/commands/rename-team.command';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { ConnectionAuthorization } from '@application/services/connection-authorization.service';
import type { TeamRepository } from '@domain/repositories/team.repository';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { TeamName } from '@domain/value-objects/team-name.vo';

export class RenameTeamHandler
  implements CommandHandlerPort<RenameTeamCommand, boolean>
{
  constructor(
    private readonly authorization: ConnectionAuthorization,
    private readonly teams: TeamRepository,
  ) {}

  async execute(command: RenameTeamCommand): Promise<boolean> {
    try {
      // Someone outside the team is not told it is there at all, and only an
      // owner or admin may rename it.
      if (
        !(await this.authorization.connectableBy(
          command.teamId,
          command.viewerId,
        ))
      ) {
        return false;
      }

      const team = await this.teams.find(TeamId.of(command.teamId));

      if (!team) {
        return false;
      }

      await this.teams.save(team.renamedTo(TeamName.of(command.name)));

      return true;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
