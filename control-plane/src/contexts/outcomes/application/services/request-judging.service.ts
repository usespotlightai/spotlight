import type { DeletionsPort } from '@outcomes/application/ports/deletions.port';
import type { EvidencePort } from '@outcomes/application/ports/evidence.port';
import type { JudgePort } from '@outcomes/application/ports/judge.port';
import type { WorkPort } from '@outcomes/application/ports/work.port';
import { Judging } from '@outcomes/domain/aggregates/judging.aggregate';
import type { JudgingRepository } from '@outcomes/domain/repositories/judging.repository';
import {
  judgesRunThatEnded,
  sampledForJudging,
} from '@outcomes/domain/services/judge-sampling';
import { Rubric } from '@outcomes/domain/value-objects/rubric.vo';
import { endingOf } from '@outcomes/domain/value-objects/run-ending';
import { RunPlace } from '@outcomes/domain/value-objects/run-place.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface RunEndedToJudge {
  readonly runId: string;
  readonly outcome: string;
  readonly stopped: boolean;
  readonly failure: string | null;
}

export class RequestJudging {
  constructor(
    private readonly work: WorkPort,
    private readonly evidence: EvidencePort,
    private readonly judge: JudgePort,
    private readonly judgings: JudgingRepository,
    private readonly deletions: DeletionsPort,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async runEnded(event: RunEndedToJudge): Promise<void> {
    const ending = endingOf(event);
    const runId = RunId.of(event.runId);

    if (!this.judge.available || !ending || !judgesRunThatEnded(ending)) {
      return;
    }

    const run = (await this.evidence.hasTask(event.runId))
      ? await this.work.endedRun(event.runId)
      : null;
    const settings = run ? await this.evidence.judgeAt(run.stationId) : null;

    if (!run || !settings || !sampledForJudging(runId, settings.sample)) {
      return;
    }

    const rubric = Rubric.readable({
      text: settings.rubric,
      claims: settings.claims,
      passShare: settings.passShare,
      version: settings.rubricVersion,
    });

    if (!rubric) {
      return;
    }

    await this.transaction.inTransaction(async () => {
      const workspaceId = WorkspaceId.of(run.workspaceId);
      const taskId = TaskId.of(run.taskId);
      const teamId = TeamId.of(run.teamId);

      await this.deletions.lockDeletion(workspaceId, taskId, teamId);

      if (
        (await this.judgings.of(runId)) ||
        (await this.deletions.isDeleted(workspaceId, taskId, teamId))
      ) {
        return;
      }

      await this.judgings.add(
        Judging.requested({
          runId,
          workspaceId,
          place: RunPlace.of({
            teamId,
            lineId: run.lineId,
            stationId: run.stationId,
            taskId,
          }),
          fingerprint: run.fingerprint,
          rubric,
          now: this.clock.now(),
        }),
      );
    });
  }
}
