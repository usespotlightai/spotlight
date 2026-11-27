import type {
  AssistOrder,
  AssistSessionsPort,
  AssistState,
} from '@assist/application/ports/assist-sessions.port';
import type { MemoryConsolidationRequest } from '@memory/application/ports/memory-consolidator.port';
import { ConsolidationRound } from '@memory/domain/value-objects/consolidation-round.vo';
import {
  AssistMemoryConsolidator,
  CONSOLIDATION_RESULT,
} from '@memory/infrastructure/consolidation/assist-memory-consolidator';
import type { JsonValue } from '@shared-kernel/domain/json-value';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';

const ROUND = ConsolidationRound.of({
  teamId: TeamId.of('team_1'),
  dueAt: new Date('2026-11-28T10:00:00.000Z'),
  attempt: 2,
});

const REQUEST: MemoryConsolidationRequest = {
  workspaceId: 'ws_1',
  round: ROUND,
  basedOnRun: RunId.of('run_9'),
  groups: [
    {
      where: 'the whole team',
      memories: [
        {
          handle: 'M-3',
          kind: 'preference',
          body: 'Name branches after tickets.',
        },
        {
          handle: 'M-7',
          kind: 'preference',
          body: 'Branches carry the ticket.',
        },
      ],
    },
  ],
};

const consolidating = (state: AssistState) => {
  const orders: AssistOrder[] = [];
  const sessions: AssistSessionsPort = {
    request: (order) => {
      orders.push(order);
      return Promise.resolve(state);
    },
  };

  return { orders, consolidator: new AssistMemoryConsolidator(sessions) };
};

const submitted = (result: JsonValue): AssistState => ({
  status: 'submitted',
  result,
  model: 'claude-code/sonnet',
  usage: null,
});

describe('consolidating memories in an assist session', () => {
  it('orders one session for the round, based on the team’s host run, with the memories as evidence', async () => {
    const { orders, consolidator } = consolidating({
      status: 'waiting',
      since: ROUND.dueAt,
    });

    await consolidator.consolidate(REQUEST);

    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({
      workspaceId: 'ws_1',
      purpose: 'memory.consolidate',
      key: `team_1:${ROUND.dueAt.getTime()}:2`,
      basedOnRun: 'run_9',
      resultSchema: CONSOLIDATION_RESULT.json,
    });
    expect(JSON.parse(orders[0]?.files['memories.json'] ?? '')).toEqual({
      groups: [
        {
          applies_to: 'the whole team',
          memories: [
            {
              handle: 'M-3',
              kind: 'preference',
              body: 'Name branches after tickets.',
            },
            {
              handle: 'M-7',
              kind: 'preference',
              body: 'Branches carry the ticket.',
            },
          ],
        },
      ],
    });
    expect(orders[0]?.briefing).toContain('.spotlight/assist/memories.json');
  });

  it('waits while the session works', async () => {
    expect(
      await consolidating({
        status: 'waiting',
        since: ROUND.dueAt,
      }).consolidator.consolidate(REQUEST),
    ).toEqual({ status: 'waiting' });
  });

  it('reads the changes the session submitted', async () => {
    const changes = [
      {
        change: 'merge',
        handles: ['M-3', 'M-7'],
        body: 'Branches carry the ticket.',
        reason: 'M-3 and M-7 say the same.',
      },
    ];

    expect(
      await consolidating(submitted({ changes })).consolidator.consolidate(
        REQUEST,
      ),
    ).toEqual({ status: 'consolidated', suggestions: changes });
  });

  it('fails with the reason of a failed session, and on a result it cannot read', async () => {
    expect(
      await consolidating({
        status: 'failed',
        reason: 'no-harness',
      }).consolidator.consolidate(REQUEST),
    ).toEqual({ status: 'failed', reason: 'no-harness' });
    expect(
      await consolidating(
        submitted({ changes: 'none' }),
      ).consolidator.consolidate(REQUEST),
    ).toEqual({ status: 'failed', reason: 'no-result' });
  });

  it('reads back the round of a session it ordered, and none of another purpose or key', async () => {
    const { orders, consolidator } = consolidating({
      status: 'waiting',
      since: ROUND.dueAt,
    });
    await consolidator.consolidate(REQUEST);
    const key = orders[0]?.key ?? '';

    expect(
      consolidator
        .roundOf({ purpose: 'memory.consolidate', key })
        ?.equals(ROUND),
    ).toBe(true);
    expect(consolidator.roundOf({ purpose: 'insights.judge', key })).toBeNull();
    expect(
      consolidator.roundOf({ purpose: 'memory.consolidate', key: 'garbled' }),
    ).toBeNull();
  });
});
