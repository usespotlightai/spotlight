import type {
  PairJudgment as InsightsPairJudgment,
  PairJudgmentsPort,
} from '@insights/application/ports/pair-judgments.port';
import type {
  PairJudgeOrder,
  PairJudgePort,
} from '@replays/application/ports/pair-judge.port';
import type { PairJudgment } from '@replays/domain/value-objects/pair-judgment';
import { modelSpentOf } from '@replays/infrastructure/acl/model-spent.translation';

const judgmentOf = (judgment: InsightsPairJudgment): PairJudgment =>
  judgment.judged
    ? {
        judged: true,
        passes: judgment.passes.map((pass) => ({
          order: pass.order,
          winner: pass.winner,
          reasons: pass.reasons.map((each) => ({
            text: each.text,
            runHunks: [...each.runHunks],
            otherHunks: [...each.otherHunks],
          })),
        })),
        model: judgment.model,
        spent: modelSpentOf(judgment.spent),
      }
    : {
        judged: false,
        failure: judgment.failure,
        spent: modelSpentOf(judgment.spent),
      };

export class InsightsPairJudge implements PairJudgePort {
  constructor(private readonly judgments: PairJudgmentsPort) {}

  get available(): boolean {
    return this.judgments.available;
  }

  async judge(order: PairJudgeOrder): Promise<PairJudgment> {
    return judgmentOf(
      await this.judgments.judge({
        runId: order.run,
        otherRunId: order.other,
        reference: order.reference,
        criteria: order.criteria,
        orders: order.orders,
      }),
    );
  }
}
