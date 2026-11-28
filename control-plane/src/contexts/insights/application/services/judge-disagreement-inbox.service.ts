import type { JudgeDisagreementQuestionsPort } from '@insights/application/ports/judge-disagreement-questions.port';
import type { JudgeDisagreementAnswered } from '@insights/domain/events/judge-disagreement-answered.event';
import type { JudgeDisagreementClaimAnswered } from '@insights/domain/events/judge-disagreement-claim-answered.event';
import type { JudgeDisagreementOpened } from '@insights/domain/events/judge-disagreement-opened.event';
import type { JudgeDisagreementWithdrawn } from '@insights/domain/events/judge-disagreement-withdrawn.event';
import type { JudgeDisagreementRepository } from '@insights/domain/repositories/judge-disagreement.repository';

export class JudgeDisagreementInbox {
  constructor(
    private readonly disagreements: JudgeDisagreementRepository,
    private readonly questions: JudgeDisagreementQuestionsPort,
  ) {}

  async moved(
    event:
      | JudgeDisagreementOpened
      | JudgeDisagreementAnswered
      | JudgeDisagreementClaimAnswered
      | JudgeDisagreementWithdrawn,
  ): Promise<void> {
    const disagreement = await this.disagreements.find(event.disagreementId);

    if (!disagreement) {
      return;
    }

    const { location, id, askedOf } = disagreement;

    if (disagreement.state === 'open') {
      await this.questions.ask(
        location.taskId,
        id,
        askedOf,
        disagreement.openQuestions,
      );
      return;
    }

    await this.questions.resolve(location.taskId, id, askedOf);
  }
}
