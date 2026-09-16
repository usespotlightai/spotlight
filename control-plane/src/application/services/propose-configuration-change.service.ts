import { lineFolder } from '@application/contracts/configuration-layout.contract';
import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import type { LineConfigReaderPort } from '@application/ports/line-config-reader.port';
import type { OpenedPullRequestDto } from '@application/ports/pull-request.port';
import type { WorkspaceReaderPort } from '@application/ports/workspace-reader.port';
import {
  LINE_PROPOSAL_TITLE,
  lineProposalBody,
} from '@application/rendering/configuration-proposal';
import type {
  ConfigurationRepo,
  ConfigurationTarget,
} from '@application/services/configuration-target.service';
import type {
  HeldFiles,
  PendingConfiguration,
} from '@application/services/pending-configuration.service';
import type { WriteConfiguration } from '@application/services/write-configuration.service';
import type { Line } from '@domain/aggregates/line.aggregate';
import type { Team } from '@domain/aggregates/team.aggregate';
import type { Workspace } from '@domain/aggregates/workspace.aggregate';
import { PendingLineUnreadableError } from '@domain/exceptions/pending-line-unreadable.error';
import { UnknownLineError } from '@domain/exceptions/unknown-line.error';
import type { LineRepository } from '@domain/repositories/line.repository';
import type { TeamRepository } from '@domain/repositories/team.repository';
import type { WorkspaceRepository } from '@domain/repositories/workspace.repository';
import { reconcileLine } from '@domain/services/reconcile-line';
import type { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import { LineId } from '@domain/value-objects/line-id.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';

interface LineChange {
  readonly teamId: string;
  readonly viewerId: string;
  readonly lineId: string;
  readonly change: (base: Line) => Line;
  readonly describe: (edited: Line) => string;
}

export interface ProposalTarget {
  readonly workspace: Workspace;
  readonly team: Team;
  readonly into: ConfigurationRepo | null;
}

export interface ConfigurationChange {
  readonly teamId: string;
  readonly viewerId: string;
  readonly title: string;
  readonly body: string;
  readonly written: (target: ProposalTarget) => Promise<{
    readonly files: readonly ConfigurationFile[];
    readonly removes?: readonly string[];
  }>;
}

export class ProposeConfigurationChange {
  constructor(
    private readonly workspaces: WorkspaceRepository,
    private readonly members: WorkspaceReaderPort,
    private readonly teams: TeamRepository,
    private readonly lines: LineRepository,
    private readonly reader: LineConfigReaderPort,
    private readonly target: ConfigurationTarget,
    private readonly writing: WriteConfiguration,
    private readonly pending: PendingConfiguration,
    private readonly ids: IdGeneratorPort,
  ) {}

  async propose(
    change: ConfigurationChange,
  ): Promise<OpenedPullRequestDto | null> {
    const found = await this.teamOf(change.teamId, change.viewerId);

    if (!found) {
      return null;
    }

    const into = await this.target.of(found.workspace, found.team);
    const written = await change.written({ ...found, into });

    if (!into || written.files.length + (written.removes?.length ?? 0) === 0) {
      return null;
    }

    return this.writing.writeInto(into, {
      title: change.title,
      body: change.body,
      ...written,
    });
  }

  async proposeLine(change: LineChange): Promise<OpenedPullRequestDto | null> {
    const found = await this.teamOf(change.teamId, change.viewerId);

    if (!found) {
      return null;
    }

    const lineId = LineId.of(change.lineId);
    const line = (await this.lines.ofTeam(found.team.id)).find((each) =>
      each.id.equals(lineId),
    );

    if (!line) {
      throw new UnknownLineError(change.lineId);
    }

    const into = await this.target.of(found.workspace, found.team);

    if (!into) {
      return null;
    }

    const held = await this.pending.under(into, lineFolder(line.key.value));
    const edited = change.change(this.standing(line, held));
    const written = this.reader.write(edited, held.files);

    return this.writing.writeInto(into, {
      title: LINE_PROPOSAL_TITLE,
      body: lineProposalBody(change.describe(edited)),
      ...written,
    });
  }

  private async teamOf(
    teamId: string,
    viewerId: string,
  ): Promise<{ workspace: Workspace; team: Team } | null> {
    const by = UserId.of(viewerId);
    const member = await this.members.findTeamForMember(teamId, by);

    if (!member) {
      return null;
    }

    const [workspace, team] = await Promise.all([
      this.workspaces.findBySlug(WorkspaceSlug.of(member.slug)),
      this.teams.find(TeamId.of(teamId)),
    ]);

    return workspace && team && workspace.mayProposeConfigurationBy(by)
      ? { workspace, team }
      : null;
  }

  private standing(found: Line, held: HeldFiles): Line {
    if (!held.onBranch || held.files.length === 0) {
      return found;
    }

    const read = this.reader.read(held.files);
    const [plan] = read.plans;

    if (!plan) {
      throw new PendingLineUnreadableError(
        found.key.value,
        read.problems.map((each) => each.reason).join('; '),
      );
    }

    try {
      const reconciled = reconcileLine({
        standing: found,
        plan,
        tasksStanding: new Map(),
        newId: () => this.ids.generate(),
      });

      if (!reconciled.ok) {
        throw new PendingLineUnreadableError(
          found.key.value,
          'it would strand work',
        );
      }

      return reconciled.line;
    } catch (error) {
      if (error instanceof PendingLineUnreadableError) {
        throw error;
      }
      throw new PendingLineUnreadableError(
        found.key.value,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
