import type {
  ChangeJudgingAgainAnswer,
  ChangeJudgingAnswer,
  ChangeJudgingPort,
  ChangeJudgingRequest,
} from '@outcomes/application/ports/change-judging.port';
import type { JudgePort } from '@outcomes/application/ports/judge.port';
import { ChangeJudging } from '@outcomes/domain/aggregates/change-judging.aggregate';
import { InvalidScoreError } from '@outcomes/domain/exceptions/invalid-score.error';
import type { ChangeJudgingRepository } from '@outcomes/domain/repositories/change-judging.repository';
import { JudgeCriteria } from '@outcomes/domain/value-objects/judge-criteria.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class RequestChangeJudging implements ChangeJudgingPort {
  constructor(
    private readonly judgings: ChangeJudgingRepository,
    private readonly judge: JudgePort,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async request(request: ChangeJudgingRequest): Promise<ChangeJudgingAnswer> {
    if (!this.judge.available) {
      return 'unavailable';
    }

    let judging: ChangeJudging;

    try {
      judging = ChangeJudging.requested({
        runId: RunId.of(request.runId),
        workspaceId: WorkspaceId.of(request.workspaceId),
        teamId: TeamId.of(request.teamId),
        criteria: JudgeCriteria.of({
          rubric: request.rubric,
          claims: request.claims,
          passShare: request.passShare,
        }),
        reference: request.reference ? RunId.of(request.reference) : null,
        now: this.clock.now(),
      });
    } catch (error) {
      if (error instanceof InvalidScoreError) {
        return 'unreadable-rubric';
      }
      throw error;
    }

    await this.transaction.inTransaction(async () => {
      if (!(await this.judgings.of(judging.runId, judging.round))) {
        await this.judgings.add(judging);
      }
    });

    return 'requested';
  }

  async requeue(runId: string): Promise<ChangeJudgingAgainAnswer> {
    if (!this.judge.available) {
      return 'unavailable';
    }

    const run = RunId.of(runId);

    return this.transaction.inTransaction(async () => {
      const first = await this.judgings.of(run, 1);

      if (!first?.judgedAt) {
        return 'unjudged';
      }
      if (!(await this.judgings.of(run, 2))) {
        await this.judgings.add(first.requeued(this.clock.now()));
      }

      return 'requested';
    });
  }
}
