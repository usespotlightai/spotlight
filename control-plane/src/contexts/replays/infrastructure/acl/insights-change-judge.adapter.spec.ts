import type {
  ChangeJudgmentOrder,
  ChangeJudgmentsPort,
} from '@insights/application/ports/change-judgments.port';
import { ChangeJudgingRound } from '@replays/domain/value-objects/change-judging-round.vo';
import { InsightsChangeJudge } from '@replays/infrastructure/acl/insights-change-judge.adapter';
import { JudgeCriteria } from '@shared-kernel/domain/value-objects/judge-criteria.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

describe('InsightsChangeJudge', () => {
  it('asks Insights to judge a replay as a run whose effects the sandbox blocked', async () => {
    const orders: ChangeJudgmentOrder[] = [];
    const judgments: ChangeJudgmentsPort = {
      judge: async (order) => {
        orders.push(order);
        return { judged: false, failure: 'unavailable' };
      },
      roundOf: () => null,
    };

    await new InsightsChangeJudge(judgments).judge({
      workspaceId: 'workspace_1',
      round: ChangeJudgingRound.of({
        runId: RunId.of('replay_1'),
        judging: 1,
        attempt: 1,
      }),
      criteria: JudgeCriteria.of({ claims: ['It drains.'] }),
      reference: null,
      guidanceRequested: false,
    });

    expect(orders).toEqual([
      {
        workspaceId: 'workspace_1',
        round: { runId: RunId.of('replay_1'), judging: 1, attempt: 1 },
        criteria: JudgeCriteria.of({ claims: ['It drains.'] }),
        reference: null,
        guidanceRequested: false,
        effectsBlocked: true,
      },
    ]);
  });

  it('reads back a settled session’s round as a replays judging round, and no other', () => {
    const session = {
      workspaceId: 'ws_1',
      purpose: 'insights.judge',
      key: 'k',
    };
    const judgingOf = (judging: number) =>
      new InsightsChangeJudge({
        judge: async () => ({ judged: false, failure: 'unavailable' }),
        roundOf: () => ({ runId: RunId.of('replay_1'), judging, attempt: 3 }),
      });

    expect(judgingOf(2).roundOf(session)).toEqual(
      ChangeJudgingRound.of({
        runId: RunId.of('replay_1'),
        judging: 2,
        attempt: 3,
      }),
    );
    expect(judgingOf(7).roundOf(session)).toBeNull();
  });
});
