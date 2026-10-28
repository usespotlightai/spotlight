import { Work } from '@replays/infrastructure/acl/work.adapter';
import type {
  LiveStation,
  ReplayCandidatesPort,
  StationSearchPolicy,
} from '@work/application/ports/replay-candidates.port';
import type { ReplayDispatchPort } from '@work/application/ports/replay-dispatch.port';
import type { ReplayableRunsPort } from '@work/application/ports/replayable-runs.port';
import type { SearchDispatchPort } from '@work/application/ports/search-dispatch.port';
import type { SearchRunsPort } from '@work/application/ports/search-runs.port';
import type { StartingPointHoldsPort } from '@work/application/ports/starting-point-holds.port';
import { describe, expect, it } from 'vitest';

const DAY = 24 * 60 * 60 * 1_000;

const SEARCH: StationSearchPolicy = {
  enabled: true,
  monthlyCeiling: 50,
  currency: 'USD',
  ceiling: 10,
  periodMilliseconds: 7 * DAY,
  onAlert: true,
  cooldownMilliseconds: 3 * DAY,
  agent: { harness: 'claude-code', model: null, effort: 'high' },
  iterations: 3,
  repeats: null,
  objective: 'cost',
};

const liveWith = (search: StationSearchPolicy | null): LiveStation => ({
  lineKey: 'delivery',
  station: {
    key: 'build',
    name: 'Build',
    kind: 'work',
  } as LiveStation['station'],
  fingerprint: 'a'.repeat(64),
  scoring: { checksChanges: false, judge: null, rubricVersion: null },
  hashes: { behaviour: 'b'.repeat(64), scoring: 'c'.repeat(64) },
  replayCheck: null,
  search,
});

const workWith = (live: LiveStation | null) =>
  new Work(
    {} as ReplayableRunsPort,
    { live: async () => live } as unknown as ReplayCandidatesPort,
    {} as ReplayDispatchPort,
    {} as StartingPointHoldsPort,
    {} as SearchDispatchPort,
    {} as SearchRunsPort,
  );

describe('Work.live', () => {
  it('reads the station’s resolved search policy as its search policy', async () => {
    const live = await workWith(liveWith(SEARCH)).live('line_1', 'station_1');

    expect(live?.search).toMatchObject({
      enabled: true,
      periodMilliseconds: 7 * DAY,
      onAlert: true,
      cooldownMilliseconds: 3 * DAY,
      agent: { harness: 'claude-code', model: null, effort: 'high' },
      iterations: 3,
      repeats: null,
      objective: 'cost',
    });
    expect(live?.search?.ceiling.amount).toBe(10);
    expect(live?.search?.monthlyCeiling.amount).toBe(50);
    expect(live?.search?.ceiling.currency).toBe('USD');
  });

  it('has no search policy when work answers none', async () => {
    const live = await workWith(liveWith(null)).live('line_1', 'station_1');

    expect(live?.search).toBeNull();
  });

  it('carries the policy as work answers it, leaving work’s limits to work', async () => {
    const live = await workWith(
      liveWith({ ...SEARCH, ceiling: 60, iterations: 11 }),
    ).live('line_1', 'station_1');

    expect(live?.search?.ceiling.amount).toBe(60);
    expect(live?.search?.iterations).toBe(11);
  });
});
