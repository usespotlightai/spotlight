import type { ChooseToolsCommand } from '@application/commands/choose-tools.command';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { LineReaderPort } from '@application/ports/line-reader.port';
import type { OpenedPullRequestDto } from '@application/ports/pull-request.port';
import type { WorkspaceReaderPort } from '@application/ports/workspace-reader.port';
import type { WriteConfiguration } from '@application/services/write-configuration.service';
import { INTEGRATIONS_UNDER } from '@domain/aggregates/team-configuration.aggregate';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import type { TeamRepository } from '@domain/repositories/team.repository';
import type { WorkspaceRepository } from '@domain/repositories/workspace.repository';
import { knownTool } from '@domain/services/known-tools';
import { contributionOf } from '@domain/services/source-contribution';
import { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import { SourceKey } from '@domain/value-objects/source-key.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';

/**
 * Writes a starting file for each host a team said it uses.
 *
 * What comes back is a pull request, not a team already listening: the files
 * are ordinary configuration, and somebody reads them before they are true.
 * Nothing is set up here. A host still has to be pointed at the door and its
 * secret still has to be set, and the pull request says so.
 */
export class ChooseToolsHandler
  implements CommandHandlerPort<ChooseToolsCommand, OpenedPullRequestDto | null>
{
  constructor(
    private readonly workspaces: WorkspaceRepository,
    private readonly members: WorkspaceReaderPort,
    private readonly teams: TeamRepository,
    private readonly writing: WriteConfiguration,
    private readonly lines: AssemblyLineRepository,
    private readonly reader: LineReaderPort,
  ) {}

  async execute(
    command: ChooseToolsCommand,
  ): Promise<OpenedPullRequestDto | null> {
    try {
      const team = await this.members.findTeamForMember(
        command.teamId,
        UserId.of(command.viewerId),
      );

      if (!team) {
        return null;
      }

      const workspace = await this.workspaces.findBySlug(
        WorkspaceSlug.of(team.slug),
      );

      // A host nobody here knows has no file to write. Said as nothing
      // rather than guessed at.
      const chosen = command.sources
        .map((each) => knownTool(each))
        .filter((each) => each !== null);

      // Taking one away needs no file, only a path, so an unknown host can
      // still be dropped: it is what a team wrote here once and no longer uses.
      const dropped = command.dropped.map(
        (each) => `${INTEGRATIONS_UNDER}/${each}.yml`,
      );

      const held = await this.teams.find(TeamId.of(command.teamId));

      if (!workspace || !held || chosen.length + dropped.length === 0) {
        return null;
      }

      // A chosen tool puts what it opens on the line; a dropped one takes its
      // rules off. Both ride the same change.
      const relined: ConfigurationFile[] = [];

      for (const line of await this.lines.ofTeam(TeamId.of(command.teamId))) {
        const opened = command.sources.reduce(
          (each, source) =>
            each.installing(contributionOf(SourceKey.of(source))),
          line,
        );
        const trimmed = command.dropped.reduce(
          (each, source) => each.withoutRulesFrom(SourceKey.of(source)),
          opened,
        );

        if (trimmed !== line) {
          relined.push(this.reader.write(trimmed));
        }
      }

      return await this.writing.write(workspace, held, {
        branch: 'spotlight/tools',
        title: titleFor(chosen.length, dropped.length),
        body: BODY,
        files: [
          ...chosen.map((tool) =>
            ConfigurationFile.of(
              `${INTEGRATIONS_UNDER}/${tool.source.value}.yml`,
              tool.file,
            ),
          ),
          ...relined,
        ],
        removes: dropped,
      });
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}

const titleFor = (written: number, taken: number): string => {
  if (written === 0) {
    return 'Stop listening to tools this team no longer uses';
  }

  return taken === 0
    ? 'Listen to the tools this team uses'
    : 'Change the tools this team listens to';
};

const BODY = `These are the hosts this team said it uses, written down.

Each file says which of that host's events become words a station can wait
for. Nothing listens yet: point the host at the address shown on the team's
integrations page, and set the secret it signs with there.

The rules here are what each host's own documentation describes. If one of
them never fires, this file is where to fix it.`;
