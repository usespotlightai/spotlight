import type { ProposeLineCommand } from '@application/commands/propose-line.command';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { WorkspaceReaderPort } from '@application/ports/workspace-reader.port';
import type {
  WriteBackLine,
  WrittenBack,
} from '@application/services/write-back-line.service';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import type { TeamRepository } from '@domain/repositories/team.repository';
import type { WorkspaceRepository } from '@domain/repositories/workspace.repository';
import { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';

/**
 * Proposes a line as it now stands on the board to the repository that holds
 * the workspace's configuration. What comes back is a pull request to read,
 * not a change already made.
 */
export class ProposeLineHandler
  implements CommandHandlerPort<ProposeLineCommand, WrittenBack | null>
{
  constructor(
    private readonly workspaces: WorkspaceRepository,
    private readonly members: WorkspaceReaderPort,
    private readonly teams: TeamRepository,
    private readonly lines: AssemblyLineRepository,
    private readonly writing: WriteBackLine,
  ) {}

  async execute(command: ProposeLineCommand): Promise<WrittenBack | null> {
    try {
      const team = await this.members.findTeamForMember(
        command.teamId,
        UserId.of(command.viewerId),
      );

      // Someone outside it is not told a team is there at all.
      if (!team) {
        return null;
      }

      const workspace = await this.workspaces.findBySlug(
        WorkspaceSlug.of(team.slug),
      );
      const line = await this.lines.find(AssemblyLineId.of(command.lineId));

      // One workspace's board may not write into another's repository.
      if (!workspace || !line?.workspaceId.equals(workspace.id)) {
        return null;
      }

      const held = await this.teams.find(TeamId.of(command.teamId));

      return held ? await this.writing.write(workspace, held, line) : null;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
