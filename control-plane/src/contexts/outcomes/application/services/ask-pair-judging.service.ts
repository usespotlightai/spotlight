import type { PairJudgePort } from '@outcomes/application/ports/pair-judge.port';
import type {
  PairJudgingAnswer,
  PairJudgingAsk,
  PairJudgingPort,
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

export class AskPairJudging implements PairJudgingPort {
  constructor(
    private readonly judgings: PairJudgingRepository,
    private readonly judge: PairJudgePort,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async ask(asked: PairJudgingAsk): Promise<PairJudgingAnswer> {
    if (!this.judge.available) {
      return 'unavailable';
    }

    let judging: PairJudging;

    try {
      judging = PairJudging.asked({
        runId: RunId.of(asked.runId),
        against: RunId.of(asked.against),
        workspaceId: WorkspaceId.of(asked.workspaceId),
        teamId: TeamId.of(asked.teamId),
        criteria: JudgeCriteria.of({
          rubric: asked.rubric,
          claims: asked.claims,
          passShare: asked.passShare,
        }),
        reference: RunId.of(asked.reference),
        mostAttempts: asked.mostAttempts,
        now: this.clock.now(),
      });
    } catch (error) {
      if (error instanceof InvalidScoreError) {
        return 'unreadable-rubric';
      }
      throw error;
    }

    try {
      await this.transaction.run(() => this.judgings.add(judging));
    } catch (error) {
      if (!(error instanceof PairJudgingVersionConflictError)) {
        throw error;
      }
    }

    return 'asked';
  }
}
