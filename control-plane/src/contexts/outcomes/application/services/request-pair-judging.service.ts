import type { PairJudgePort } from '@outcomes/application/ports/pair-judge.port';
import type {
  PairJudgingAnswer,
  PairJudgingPort,
  PairJudgingRequest,
} from '@outcomes/application/ports/pair-judging.port';
import { PairJudging } from '@outcomes/domain/aggregates/pair-judging.aggregate';
import { InvalidScoreError } from '@outcomes/domain/exceptions/invalid-score.error';
import { PairJudgingVersionConflictError } from '@outcomes/domain/exceptions/pair-judging-version-conflict.error';
import type { PairJudgingRepository } from '@outcomes/domain/repositories/pair-judging.repository';
import { JudgeCriteria } from '@outcomes/domain/value-objects/judge-criteria.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class RequestPairJudging implements PairJudgingPort {
  constructor(
    private readonly judgings: PairJudgingRepository,
    private readonly judge: PairJudgePort,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async request(request: PairJudgingRequest): Promise<PairJudgingAnswer> {
    if (!this.judge.available) {
      return 'unavailable';
    }

    let judging: PairJudging;

    try {
      judging = PairJudging.requested({
        runId: RunId.of(request.runId),
        against: RunId.of(request.against),
        workspaceId: WorkspaceId.of(request.workspaceId),
        teamId: TeamId.of(request.teamId),
        criteria: JudgeCriteria.of({
          rubric: request.rubric,
          claims: request.claims,
          passShare: request.passShare,
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
      if (!(error instanceof PairJudgingVersionConflictError)) {
        throw error;
      }
    }

    return 'requested';
  }
}
