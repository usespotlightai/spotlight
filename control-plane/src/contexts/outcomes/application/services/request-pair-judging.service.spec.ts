import { RequestPairJudging } from '@outcomes/application/services/request-pair-judging.service';
import { PairJudgingsInMemory } from '@outcomes/domain/judging.fake-spec';
import { inTransaction } from '@outcomes/domain/outcomes.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-03T10:00:00.000Z');

const REQUEST = {
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

const requesting = (available = true) => {
  const judgings = new PairJudgingsInMemory();
  const service = new RequestPairJudging(
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

describe('RequestPairJudging', () => {
  it('creates one pending side-by-side judging of the two runs, however often it is requested', async () => {
    const { judgings, service } = requesting();

    expect(await service.request(REQUEST)).toBe('requested');
    expect(await service.request(REQUEST)).toBe('requested');

    const judging = await judgings.of(
      RunId.of('replay_1'),
      RunId.of('replay_2'),
    );
    expect(judgings.stored.size).toBe(1);
    expect(judging?.reference.value).toBe('original_1');
    expect(judging?.criteria.claims).toEqual(['It drains.']);
  });

  it('says no judge is available without one', async () => {
    const { judgings, service } = requesting(false);

    expect(await service.request(REQUEST)).toBe('unavailable');
    expect(judgings.stored.size).toBe(0);
  });

  it('says it cannot read a judge with neither a rubric nor claims, or a pair of one run', async () => {
    const { service } = requesting();

    expect(await service.request({ ...REQUEST, claims: [] })).toBe(
      'unreadable-rubric',
    );
    expect(await service.request({ ...REQUEST, against: 'replay_1' })).toBe(
      'unreadable-rubric',
    );
  });
});
