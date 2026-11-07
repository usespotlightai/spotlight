import type {
  ChangeJudgmentsPort,
  ChangeJudgment as InsightsChangeJudgment,
} from '@insights/application/ports/change-judgments.port';
import type {
  ChangeJudgeOrder,
  ChangeJudgePort,
} from '@replays/application/ports/change-judge.port';
import type { ChangeJudgment } from '@replays/domain/value-objects/change-judgment';
import { modelSpentOf } from '@replays/infrastructure/acl/model-spent.translation';

const judgmentOf = (judgment: InsightsChangeJudgment): ChangeJudgment =>
  judgment.judged
    ? {
        judged: true,
        value: judgment.value,
        claimResults: judgment.claimResults,
        reasons: judgment.reasons.map((each) => ({
          text: each.text,
          steps: [...each.steps],
          hunks: [...each.hunks],
          claim: each.claim,
        })),
        guidance: judgment.guidance,
        referenced: judgment.referenced,
        model: judgment.model,
        spent: modelSpentOf(judgment.spent),
      }
    : {
        judged: false,
        failure: judgment.failure,
        spent: modelSpentOf(judgment.spent),
      };

export class InsightsChangeJudge implements ChangeJudgePort {
  constructor(private readonly judgments: ChangeJudgmentsPort) {}

  get available(): boolean {
    return this.judgments.available;
  }

  async judge(order: ChangeJudgeOrder): Promise<ChangeJudgment> {
    return judgmentOf(
      await this.judgments.judge({
        runId: order.run,
        criteria: order.criteria,
        reference: order.reference,
        guidanceRequested: order.guidanceRequested,
      }),
    );
  }
}
