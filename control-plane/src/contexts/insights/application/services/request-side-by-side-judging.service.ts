import type { SideBySideJudgePort } from '@insights/application/ports/side-by-side-judge.port';
import type {
  SideBySideJudgingAnswer,
  SideBySideJudgingPort,
  SideBySideJudgingRequest,
} from '@insights/application/ports/side-by-side-judging.port';
import { SideBySideJudging } from '@insights/domain/aggregates/side-by-side-judging.aggregate';
import { InvalidScoreError } from '@insights/domain/exceptions/invalid-score.error';
import { SideBySideJudgingVersionConflictError } from '@insights/domain/exceptions/side-by-side-judging-version-conflict.error';
import type { SideBySideJudgingRepository } from '@insights/domain/repositories/side-by-side-judging.repository';
import { JudgeCriteria } from '@insights/domain/value-objects/judge-criteria.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class RequestSideBySideJudging implements SideBySideJudgingPort {
  constructor(
    private readonly judgings: SideBySideJudgingRepository,
    private readonly judge: SideBySideJudgePort,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async request(
    request: SideBySideJudgingRequest,
  ): Promise<SideBySideJudgingAnswer> {
    if (!this.judge.available) {
      return 'unavailable';
    }

    let judging: SideBySideJudging;

    try {
      judging = SideBySideJudging.requested({
        runId: RunId.of(request.runId),
        otherRunId: RunId.of(request.otherRunId),
        workspaceId: WorkspaceId.of(request.workspaceId),
        teamId: TeamId.of(request.teamId),
        criteria: JudgeCriteria.of({
          rubric: request.rubric,
          claims: request.claims,
          passThreshold: request.passThreshold,
        }),
        reference: RunId.of(request.reference),
        maxAttempts: request.maxAttempts,
        now: this.clock.now(),
      });
    } catch (error) {
      if (error instanceof InvalidScoreError) {
        return 'unreadable-rubric';
      }
      throw error;
    }

    try {
      await this.transaction.inTransaction(() => this.judgings.add(judging));
    } catch (error) {
      if (!(error instanceof SideBySideJudgingVersionConflictError)) {
        throw error;
      }
    }

    return 'requested';
  }
}
