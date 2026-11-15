import type { JudgeDisagreementQuestionsPort } from '@insights/application/ports/judge-disagreement-questions.port';
import type { JudgeDisagreementAnswered } from '@insights/domain/events/judge-disagreement-answered.event';
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
      | JudgeDisagreementWithdrawn,
  ): Promise<void> {
    const disagreement = await this.disagreements.find(event.disagreementId);

    if (disagreement?.state === 'open') {
      await this.questions.ask(
        disagreement.location.taskId,
        disagreement.id,
        disagreement.askedOf,
      );
      return;
    }

    await this.questions.resolve(event.location.taskId, event.disagreementId);
  }
}
