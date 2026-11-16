import type { AnswerJudgeDisagreementCommand } from '@insights/application/commands/answer-judge-disagreement.command';
import type { TeamJudgeDisagreements } from '@insights/application/services/team-judge-disagreements.service';
import type { JudgeDisagreementRepository } from '@insights/domain/repositories/judge-disagreement.repository';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';

export class AnswerJudgeDisagreementHandler implements CommandHandlerPort<
  AnswerJudgeDisagreementCommand,
  void
> {
  constructor(
    private readonly onTeam: TeamJudgeDisagreements,
    private readonly disagreements: JudgeDisagreementRepository,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: AnswerJudgeDisagreementCommand): Promise<void> {
    try {
      const { access, disagreement } = await this.onTeam.onTeam(command);
      const answered = disagreement.answerNotMet({
        shouldHaveFailed: command.shouldHaveFailed,
        note: command.note,
        by: access.by,
        now: this.clock.now(),
      });

      await this.transaction.inTransaction(() =>
        this.disagreements.save(answered),
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
