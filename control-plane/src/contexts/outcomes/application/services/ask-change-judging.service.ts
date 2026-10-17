import type {
  ChangeJudgingAgainAnswer,
  ChangeJudgingAnswer,
  ChangeJudgingAsk,
  ChangeJudgingPort,
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

export class AskChangeJudging implements ChangeJudgingPort {
  constructor(
    private readonly judgings: ChangeJudgingRepository,
    private readonly judge: JudgePort,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async ask(asked: ChangeJudgingAsk): Promise<ChangeJudgingAnswer> {
    if (!this.judge.available) {
      return 'unavailable';
    }

    let judging: ChangeJudging;

    try {
      judging = ChangeJudging.asked({
        runId: RunId.of(asked.runId),
        workspaceId: WorkspaceId.of(asked.workspaceId),
        teamId: TeamId.of(asked.teamId),
        criteria: JudgeCriteria.of({
          rubric: asked.rubric,
          claims: asked.claims,
          passShare: asked.passShare,
        }),
        reference: asked.reference ? RunId.of(asked.reference) : null,
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

    return 'asked';
  }

  async askAgain(runId: string): Promise<ChangeJudgingAgainAnswer> {
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
        await this.judgings.add(first.askedAgain(this.clock.now()));
      }

      return 'asked';
    });
  }
}
