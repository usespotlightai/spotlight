import type {
  PairJudgment as InsightsPairJudgment,
  PairJudgmentOrder,
  PairJudgmentPass,
  PairJudgmentsPort,
} from '@insights/application/ports/pair-judgments.port';
import type {
  PairJudgeOrder,
  PairJudgePort,
} from '@replays/application/ports/pair-judge.port';
import type { PairOutcome } from '@replays/domain/value-objects/entry-pairing.vo';
import type { PairJudgment } from '@replays/domain/value-objects/pair-judgment';
import type { PairOrder } from '@replays/domain/value-objects/pair-order';

type InsightsPairOrder = PairJudgmentOrder['orders'][number];

const INSIGHTS_ORDER_OF: Readonly<Record<PairOrder, InsightsPairOrder>> = {
  'run-first': 'run-first',
  'other-first': 'other-first',
};

const RUN_SHOWN_FIRST: Readonly<Record<InsightsPairOrder, boolean>> = {
  'run-first': true,
  'other-first': false,
};

const OUTCOME_OF: Readonly<Record<PairJudgmentPass['winner'], PairOutcome>> = {
  run: 'win',
  other: 'loss',
  tie: 'tie',
};

const judgmentOf = (judgment: InsightsPairJudgment): PairJudgment =>
  judgment.judged
    ? {
        judged: true,
        passes: judgment.passes.map((pass) => ({
          ownShownFirst: RUN_SHOWN_FIRST[pass.order],
          outcome: OUTCOME_OF[pass.winner],
          reasons: pass.reasons.map((each) => ({
            text: each.text,
            ownHunks: [...each.runHunks],
            theirHunks: [...each.otherHunks],
          })),
        })),
        model: judgment.model,
      }
    : {
        judged: false,
        failure: judgment.failure,
      };

export class InsightsPairJudge implements PairJudgePort {
  constructor(private readonly judgments: PairJudgmentsPort) {}

  availableTo(workspaceId: string): Promise<boolean> {
    return this.judgments.availableTo(workspaceId);
  }

  async judge(order: PairJudgeOrder): Promise<PairJudgment> {
    return judgmentOf(
      await this.judgments.judge({
        workspaceId: order.workspaceId,
        runId: order.run,
        otherRunId: order.other,
        reference: order.reference,
        criteria: order.criteria,
        orders: order.orders.map((each) => INSIGHTS_ORDER_OF[each]),
      }),
    );
  }
}
