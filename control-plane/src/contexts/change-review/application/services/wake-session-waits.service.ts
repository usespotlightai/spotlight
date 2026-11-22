import type {
  AssistRoundsPort,
  AssistSession,
} from '@change-review/application/ports/assist-rounds.port';
import { ChangeStackVersionConflictError } from '@change-review/domain/exceptions/change-stack-version-conflict.error';
import { QuestionAnswerVersionConflictError } from '@change-review/domain/exceptions/question-answer-version-conflict.error';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import type { QuestionAnswerRepository } from '@change-review/domain/repositories/question-answer.repository';
import type { DraftingRound } from '@change-review/domain/value-objects/drafting-round.vo';
import type { GradingRound } from '@change-review/domain/value-objects/grading-round.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';

/**
 * Makes the job that waits for an assist session due now, once the session settles, instead of at its next look. A
 * job that someone saved meanwhile is at work already, so a version conflict wakes nothing.
 */
export class WakeSessionWaits {
  constructor(
    private readonly rounds: AssistRoundsPort,
    private readonly stacks: ChangeStackRepository,
    private readonly answers: QuestionAnswerRepository,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async settled(session: AssistSession): Promise<void> {
    const ran = this.rounds.roundOf(session);

    if (!ran) {
      return;
    }

    try {
      await this.transaction.inTransaction(() =>
        ran.of === 'drafting'
          ? this.wakeDrafting(ran.round)
          : this.wakeGrading(ran.round),
      );
    } catch (error) {
      if (
        error instanceof ChangeStackVersionConflictError ||
        error instanceof QuestionAnswerVersionConflictError
      ) {
        return;
      }
      throw error;
    }
  }

  private async wakeDrafting(round: DraftingRound): Promise<void> {
    const stack = await this.stacks.find(round.stackId);
    const woken = stack?.wake(round, this.clock.now());

    if (stack && woken && woken !== stack) {
      await this.stacks.save(woken);
    }
  }

  private async wakeGrading(round: GradingRound): Promise<void> {
    const answer = await this.answers.find(round.answerId);
    const woken = answer?.wake(round, this.clock.now());

    if (answer && woken && woken !== answer) {
      await this.answers.save(woken);
    }
  }
}
