import type {
  ChangeJudgmentsPort,
  ChangeJudgment as InsightsChangeJudgment,
} from '@insights/application/ports/change-judgments.port';
import type {
  ChangeJudgeOrder,
  ChangeJudgePort,
} from '@replays/application/ports/change-judge.port';
import type { ChangeJudgment } from '@replays/domain/value-objects/change-judgment';

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
      }
    : {
        judged: false,
        failure: judgment.failure,
      };

export class InsightsChangeJudge implements ChangeJudgePort {
  constructor(private readonly judgments: ChangeJudgmentsPort) {}

  availableTo(workspaceId: string): Promise<boolean> {
    return this.judgments.availableTo(workspaceId);
  }

  async judge(order: ChangeJudgeOrder): Promise<ChangeJudgment> {
    return judgmentOf(
      await this.judgments.judge({
        workspaceId: order.workspaceId,
        runId: order.run,
        criteria: order.criteria,
        reference: order.reference,
        guidanceRequested: order.guidanceRequested,
        effectsBlocked: true,
      }),
    );
  }
}
