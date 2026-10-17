import { AskPairJudging } from '@outcomes/application/services/ask-pair-judging.service';
import { PairJudgingsInMemory } from '@outcomes/domain/judging.fake-spec';
import { inTransaction } from '@outcomes/domain/outcomes.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-03T10:00:00.000Z');

const ASK = {
  runId: 'replay_1',
  against: 'replay_2',
  workspaceId: 'ws_1',
  teamId: 'team_1',
  rubric: null as string | null,
  claims: ['It drains.'] as readonly string[],
  passShare: 1,
  reference: 'original_1',
  maxAttempts: 2,
};

const asking = (available = true) => {
  const judgings = new PairJudgingsInMemory();
  const service = new AskPairJudging(
    judgings,
    {
      available,
      model: 'some/model',
      judgePair: async () => ({
        verdict: { preferred: 'tie', reasons: [] },
        usage: null,
      }),
    },
    inTransaction,
    { now: () => NOW, sleep: async () => {} },
  );

  return { judgings, service };
};

describe('AskPairJudging', () => {
  it('owes one side-by-side judging of the two runs, however often it is asked', async () => {
    const { judgings, service } = asking();

    expect(await service.ask(ASK)).toBe('asked');
    expect(await service.ask(ASK)).toBe('asked');

    const held = await judgings.of(RunId.of('replay_1'), RunId.of('replay_2'));
    expect(judgings.held.size).toBe(1);
    expect(held?.reference.value).toBe('original_1');
    expect(held?.criteria.claims).toEqual(['It drains.']);
  });

  it('says no judge is there to ask without one', async () => {
    const { judgings, service } = asking(false);

    expect(await service.ask(ASK)).toBe('unavailable');
    expect(judgings.held.size).toBe(0);
  });

  it('says it cannot read a judge with neither a rubric nor claims, or a pair of one run', async () => {
    const { service } = asking();

    expect(await service.ask({ ...ASK, claims: [] })).toBe('unreadable-rubric');
    expect(await service.ask({ ...ASK, against: 'replay_1' })).toBe(
      'unreadable-rubric',
    );
  });
});
