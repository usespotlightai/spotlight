import type { EvidencePort } from '@insights/application/ports/evidence.port';
import type { JudgePort } from '@insights/application/ports/judge.port';
import type { StationJudgesPort } from '@insights/application/ports/station-judges.port';
import type { WorkPort } from '@insights/application/ports/work.port';
import type { FactRecorder } from '@insights/application/services/fact-recorder.service';
import { Judging } from '@insights/domain/aggregates/judging.aggregate';
import type { JudgingRepository } from '@insights/domain/repositories/judging.repository';
import {
  judgesRunThatEnded,
  sampledForJudging,
} from '@insights/domain/services/judge-sampling';
import { ConfigFingerprint } from '@insights/domain/value-objects/config-fingerprint.vo';
import { FactOwner } from '@insights/domain/value-objects/fact-owner.vo';
import { Rubric } from '@insights/domain/value-objects/rubric.vo';
import type { RunEnding } from '@insights/domain/value-objects/run-ending';
import { RunLocation } from '@insights/domain/value-objects/run-location.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface RunEndedToJudge {
  readonly runId: string;
  readonly taskId: string | null;
  readonly stationId: string | null;
  readonly ending: RunEnding | null;
}

export class RequestJudging {
  constructor(
    private readonly work: WorkPort,
    private readonly evidence: EvidencePort,
    private readonly judges: StationJudgesPort,
    private readonly judge: JudgePort,
    private readonly judgings: JudgingRepository,
    private readonly recorder: FactRecorder,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async runEnded(event: RunEndedToJudge): Promise<void> {
    const { ending } = event;
    const runId = RunId.of(event.runId);

    if (
      !event.taskId ||
      !event.stationId ||
      !this.judge.available ||
      !ending ||
      !judgesRunThatEnded(ending)
    ) {
      return;
    }

    const run = (await this.evidence.hasTask(event.runId))
      ? await this.work.endedRun(event.runId)
      : null;
    const settings = run ? await this.judges.judgeAt(run.stationId) : null;

    if (!run || !settings || !sampledForJudging(runId, settings.sample)) {
      return;
    }

    const rubric = Rubric.readable({
      text: settings.rubric,
      claims: settings.claims,
      passThreshold: settings.passThreshold,
      version: settings.rubricVersion,
    });

    if (!rubric) {
      return;
    }

    const workspaceId = WorkspaceId.of(run.workspaceId);
    const taskId = TaskId.of(run.taskId);
    const teamId = TeamId.of(run.teamId);

    await this.transaction.inTransaction(() =>
      this.recorder.record(this.judgings, {
        owner: FactOwner.of(workspaceId, { teamId, taskId }),
        load: () => this.judgings.of(runId),
        created: () =>
          Judging.requested({
            runId,
            workspaceId,
            location: RunLocation.of({
              teamId,
              lineId: LineId.of(run.lineId),
              stationId: StationId.of(run.stationId),
              taskId,
            }),
            fingerprint: ConfigFingerprint.readable(run.fingerprint),
            rubric,
            now: this.clock.now(),
          }),
        change: (existing) => existing,
      }),
    );
  }
}
