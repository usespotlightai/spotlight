import type { AnswerDisagreementClaimCommand } from '@insights/application/commands/answer-disagreement-claim.command';
import type { TeamJudgeDisagreements } from '@insights/application/services/team-judge-disagreements.service';
import type { JudgeDisagreementRepository } from '@insights/domain/repositories/judge-disagreement.repository';
import { claimAnswerKindOf } from '@insights/domain/value-objects/claim-answer.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';

export class AnswerDisagreementClaimHandler implements CommandHandlerPort<
  AnswerDisagreementClaimCommand,
  void
> {
  constructor(
    private readonly onTeam: TeamJudgeDisagreements,
    private readonly disagreements: JudgeDisagreementRepository,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: AnswerDisagreementClaimCommand): Promise<void> {
    try {
      const { access, disagreement } = await this.onTeam.onTeam(command);
      const answered = disagreement.answerClaim({
        claim: command.claim,
        answer: claimAnswerKindOf(command.answer),
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
