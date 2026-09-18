import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { lineFolder } from '@work/application/contracts/line-layout.contract';
import type { ProposedChangeDto } from '@work/application/dto/proposed-change.dto';
import type {
  ConfigurationProposalsPort,
  Pending,
} from '@work/application/ports/configuration-proposals.port';
import type { LineConfigReaderPort } from '@work/application/ports/line-config-reader.port';
import type { LineConfigWriterPort } from '@work/application/ports/line-config-writer.port';
import {
  LINE_PROPOSAL_TITLE,
  lineProposalBody,
} from '@work/application/rendering/configuration-proposal';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import { PendingLineUnreadableError } from '@work/domain/exceptions/pending-line-unreadable.error';
import { UnknownLineError } from '@work/domain/exceptions/unknown-line.error';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import { reconcileLine } from '@work/domain/services/reconcile-line';
import { LineId } from '@work/domain/value-objects/line-id.vo';

export interface LineChange {
  readonly teamId: string;
  readonly viewerId: string;
  readonly lineId: string;
  readonly change: (base: Line) => Line;
  readonly describe: (edited: Line) => string;
}

export class ProposeLineChange {
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly lines: LineRepository,
    private readonly reader: LineConfigReaderPort,
    private readonly writer: LineConfigWriterPort,
    private readonly proposals: ConfigurationProposalsPort,
    private readonly ids: IdGeneratorPort,
  ) {}

  async propose(change: LineChange): Promise<ProposedChangeDto | null> {
    const teamId = await this.proposableBy(change.teamId, change.viewerId);

    if (!teamId) {
      return null;
    }

    const lineId = LineId.of(change.lineId);
    const line = (await this.lines.ofTeam(teamId)).find((each) =>
      each.id.equals(lineId),
    );

    if (!line) {
      throw new UnknownLineError(change.lineId);
    }

    const held = await this.proposals.pendingUnder(
      teamId,
      lineFolder(line.key.value),
    );

    if (!held) {
      return null;
    }

    const edited = change.change(this.standing(line, held));
    const written = this.writer.write(edited, held.files);

    return this.proposals.propose(teamId, {
      title: LINE_PROPOSAL_TITLE,
      body: lineProposalBody(change.describe(edited)),
      ...written,
    });
  }

  private async proposableBy(
    teamId: string,
    viewerId: string,
  ): Promise<TeamId | null> {
    return (
      (await this.access.onTeam(teamId, UserId.of(viewerId)))?.teamId ?? null
    );
  }

  private standing(found: Line, held: Pending): Line {
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
