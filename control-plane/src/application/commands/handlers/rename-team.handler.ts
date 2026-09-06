import type { RenameTeamCommand } from '@application/commands/rename-team.command';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { WorkspaceReaderPort } from '@application/ports/workspace-reader.port';
import type { TeamRepository } from '@domain/repositories/team.repository';
import type { WorkspaceRepository } from '@domain/repositories/workspace.repository';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { TeamName } from '@domain/value-objects/team-name.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';

export class RenameTeamHandler
  implements CommandHandlerPort<RenameTeamCommand, boolean>
{
  constructor(
    private readonly members: WorkspaceReaderPort,
    private readonly workspaces: WorkspaceRepository,
    private readonly teams: TeamRepository,
  ) {}

  async execute(command: RenameTeamCommand): Promise<boolean> {
    try {
      const by = UserId.of(command.viewerId);
      const of = await this.members.findTeamForMember(command.teamId, by);

      // Someone outside it is not told a team is there at all.
      if (!of) {
        return false;
      }

      const workspace = await this.workspaces.findBySlug(
        WorkspaceSlug.of(of.slug),
      );

      if (!workspace?.mayBeConnectedBy(by)) {
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
