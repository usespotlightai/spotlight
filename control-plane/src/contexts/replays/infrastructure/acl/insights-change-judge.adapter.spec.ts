import type {
  ChangeJudgmentOrder,
  ChangeJudgmentsPort,
} from '@insights/application/ports/change-judgments.port';
import { InsightsChangeJudge } from '@replays/infrastructure/acl/insights-change-judge.adapter';
import { JudgeCriteria } from '@shared-kernel/domain/value-objects/judge-criteria.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

describe('InsightsChangeJudge', () => {
  it('asks Insights to judge a replay as a run whose effects the sandbox blocked', async () => {
    const orders: ChangeJudgmentOrder[] = [];
    const judgments: ChangeJudgmentsPort = {
      available: true,
      judge: async (order) => {
        orders.push(order);
        return { judged: false, failure: 'unavailable' };
      },
    };

    await new InsightsChangeJudge(judgments).judge({
      run: RunId.of('replay_1'),
      criteria: JudgeCriteria.of({ rubric: 'It drains.' }),
      reference: null,
      guidanceRequested: false,
    });

    expect(orders).toEqual([
      {
        runId: RunId.of('replay_1'),
        criteria: JudgeCriteria.of({ rubric: 'It drains.' }),
        reference: null,
        guidanceRequested: false,
        effectsBlocked: true,
      },
    ]);
  });
});
