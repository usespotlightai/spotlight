import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import type { LineReaderPort } from '@application/ports/line-reader.port';
import type { LoggerPort } from '@application/ports/logger.port';
import type { OpenedPullRequestDto } from '@application/ports/pull-request.port';
import type { RepositoryContentsPort } from '@application/ports/repository-contents.port';
import type { WorkspaceReaderPort } from '@application/ports/workspace-reader.port';
import type {
  ConfigurationRepo,
  ConfigurationTarget,
} from '@application/services/configuration-target.service';
import type { WriteConfiguration } from '@application/services/write-configuration.service';
import type { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import {
  CONFIGURATION_BRANCH,
  linePath,
} from '@domain/aggregates/team-configuration.aggregate';
import { UnknownAssemblyLineError } from '@domain/exceptions/unknown-assembly-line.error';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import type { TeamRepository } from '@domain/repositories/team.repository';
import type { WorkspaceRepository } from '@domain/repositories/workspace.repository';
import { reconcileLine } from '@domain/services/reconcile-line';
import { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';
import { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';

export interface LineChange {
  readonly teamId: string;
  readonly viewerId: string;
  readonly lineId: string;
  readonly change: (base: AssemblyLine) => AssemblyLine;
  readonly describe: (edited: AssemblyLine) => {
    readonly title: string;
    readonly body: string;
  };
}

/**
 * A change to a line, written back as a pull request rather than to the board.
 * The edit lands on the line as the branch already has it, so edits before a
 * merge accumulate instead of overwriting each other.
 */
export class ProposeLineChange {
  constructor(
    private readonly workspaces: WorkspaceRepository,
    private readonly members: WorkspaceReaderPort,
    private readonly teams: TeamRepository,
    private readonly lines: AssemblyLineRepository,
    private readonly reader: LineReaderPort,
    private readonly contents: RepositoryContentsPort,
    private readonly target: ConfigurationTarget,
    private readonly writing: WriteConfiguration,
    private readonly ids: IdGeneratorPort,
    private readonly logger: LoggerPort,
  ) {}

  async propose(change: LineChange): Promise<OpenedPullRequestDto | null> {
    const member = await this.members.findTeamForMember(
      change.teamId,
      UserId.of(change.viewerId),
    );

    if (!member) {
      return null;
    }

    const [workspace, team, found] = await Promise.all([
      this.workspaces.findBySlug(WorkspaceSlug.of(member.slug)),
      this.teams.find(TeamId.of(change.teamId)),
      this.lines.find(AssemblyLineId.of(change.lineId)),
    ]);

    if (!workspace || !team || !found) {
      throw new UnknownAssemblyLineError(change.lineId);
    }

    const into = await this.target.of(workspace, team);
    const base = into ? await this.standing(found, into) : found;

    const edited = change.change(base);
    const { title, body } = change.describe(edited);

    return this.writing.write(workspace, team, {
      branch: CONFIGURATION_BRANCH,
      title,
      body,
      files: [this.reader.write(edited)],
    });
  }

  private async standing(
    found: AssemblyLine,
    into: ConfigurationRepo,
  ): Promise<AssemblyLine> {
    const file = await this.contents.read({
      installation: into.installation,
      repository: into.repository,
      ref: CONFIGURATION_BRANCH,
      path: linePath(found.key.value),
    });

    if (!file) {
      return found;
    }

    const [plan] = this.reader.read([
      ConfigurationFile.of(file.path, file.text),
    ]).plans;

    if (!plan) {
      this.logger.warn(
        { line: found.key.value, path: file.path },
        'the configuration branch has a line file that does not compile',
      );

      return found;
    }

    const reconciled = reconcileLine({
      standing: found,
      plan,
      tasksStanding: new Map(),
      newId: () => this.ids.generate(),
    });

    return reconciled.ok ? reconciled.line : found;
  }
}
