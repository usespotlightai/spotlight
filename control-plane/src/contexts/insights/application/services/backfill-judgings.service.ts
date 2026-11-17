import type { JudgePort } from '@insights/application/ports/judge.port';
import type { StationFactsPort } from '@insights/application/ports/station-facts.port';
import type { StationJudgesPort } from '@insights/application/ports/station-judges.port';
import type { FactRecorder } from '@insights/application/services/fact-recorder.service';
import { Judging } from '@insights/domain/aggregates/judging.aggregate';
import type { JudgingRepository } from '@insights/domain/repositories/judging.repository';
import { MAX_LABELLED_RUNS } from '@insights/domain/services/revision-split';
import { FactOwner } from '@insights/domain/value-objects/fact-owner.vo';
import { Rubric } from '@insights/domain/value-objects/rubric.vo';
import type { RunFact } from '@insights/domain/value-objects/run-fact.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const MAX_RECENT_RUNS = 200;

export interface ChangedLine {
  readonly lineId: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly deleted: boolean;
  readonly stationIds: readonly string[];
}

export class BackfillJudgings {
  constructor(
    private readonly judgings: JudgingRepository,
    private readonly facts: StationFactsPort,
    private readonly judges: StationJudgesPort,
    private readonly judge: JudgePort,
    private readonly recorder: FactRecorder,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async lineChanged(event: ChangedLine): Promise<void> {
    if (event.deleted || !(await this.judge.availableTo(event.workspaceId))) {
      return;
    }

    for (const stationId of event.stationIds) {
      await this.backfill({
        workspaceId: WorkspaceId.of(event.workspaceId),
        teamId: TeamId.of(event.teamId),
        lineId: LineId.of(event.lineId),
        stationId: StationId.of(stationId),
      });
    }
  }

  private async backfill(station: {
    workspaceId: WorkspaceId;
    teamId: TeamId;
    lineId: LineId;
    stationId: StationId;
  }): Promise<void> {
    const judge = await this.judges.judgeAt(station.stationId);
    const rubric =
      judge && judge.lineId.equals(station.lineId)
        ? Rubric.readable({
            claims: judge.claims,
            passThreshold: judge.passThreshold,
            version: judge.rubricVersion,
          })
        : null;

    if (!rubric) {
      return;
    }

    const scored = await this.facts.judgedAtStation({
      ...station,
      rubricVersion: rubric.version,
      last: 1,
    });

    if (scored.length > 0) {
      return;
    }

    const labelled = (
      await this.facts.lastEndedAt({ ...station, last: MAX_RECENT_RUNS })
    )
      .filter((fact) => fact.humanLabel !== null)
      .slice(0, MAX_LABELLED_RUNS);

    for (const fact of labelled) {
      await this.rejudge(fact, rubric);
    }
  }

  private rejudge(fact: RunFact, rubric: Rubric): Promise<void> {
    const { location, fingerprint } = fact.end;
    const now = this.clock.now();

    return this.transaction.inTransaction(() =>
      this.recorder.record(this.judgings, {
        owner: FactOwner.of(fact.workspaceId, {
          teamId: location.teamId,
          taskId: location.taskId,
        }),
        load: () => this.judgings.of(fact.runId),
        deleted: (existing) => existing.delete(),
        created: () =>
          Judging.requested({
            runId: fact.runId,
            workspaceId: fact.workspaceId,
            location,
            fingerprint,
            rubric,
            now,
            origin: 'backfill',
          }),
        change: (existing) => existing.rejudged(rubric, now),
      }),
    );
  }
}
