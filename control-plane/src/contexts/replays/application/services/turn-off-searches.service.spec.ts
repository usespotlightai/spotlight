import type { WorkPort } from '@replays/application/ports/work.port';
import {
  CLOCK,
  FakeWork,
  InMemoryReplays,
  TRANSACTION,
} from '@replays/application/services/replays.fake-spec';
import { TurnOffSearches } from '@replays/application/services/turn-off-searches.service';
import type { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import { aSearch, aSet, NOW, STATION } from '@replays/domain/replays.fake-spec';
import { SearchPolicy } from '@replays/domain/value-objects/search-policy.vo';
import { beforeEach, describe, expect, it } from 'vitest';

let memory: InMemoryReplays;
let work: FakeWork;
let enabled: Map<string, boolean>;

const policyOf = (on: boolean): SearchPolicy =>
  SearchPolicy.of({
    enabled: on,
    monthlyCeiling: 50,
    currency: 'USD',
    ceiling: 10,
    periodMilliseconds: 86_400_000,
    onAlert: false,
    cooldownMilliseconds: 86_400_000,
    agent: null,
    iterations: null,
    repeats: null,
    objective: null,
  });

const turningOff = () =>
  new TurnOffSearches(memory.searchRepository, work, TRANSACTION, CLOCK);

const searchAt = async (id: string, set: ReplaySet): Promise<Search> => {
  const search = aSearch({ id, set });

  await memory.searchRepository.add(search);

  return search;
};

const stateOf = (id: string) => memory.searches.get(id);

beforeEach(() => {
  memory = new InMemoryReplays();
  work = new FakeWork();
  enabled = new Map();

  const live = work.live;

  (work as { live: WorkPort['live'] }).live = async (_lineId, stationId) => ({
    ...(await live()),
    search: policyOf(enabled.get(stationId) ?? true),
  });
});

describe('TurnOffSearches', () => {
  it('stops the search of a station whose resolved policy is off, though its line is on', async () => {
    await searchAt('search_1', aSet(10));
    enabled.set(STATION.stationId, false);

    await turningOff().lineChanged(STATION.lineId);

    expect(stateOf('search_1')).toMatchObject({
      current: 'stopped',
      stopReason: 'turned-off',
      endedAt: NOW,
    });
  });

  it('leaves a search on while its policy is on, and when another line changed', async () => {
    await searchAt('search_1', aSet(10));

    await turningOff().lineChanged(STATION.lineId);

    expect(stateOf('search_1')?.isActive).toBe(true);

    enabled.set(STATION.stationId, false);
    await turningOff().lineChanged('line_other');

    expect(stateOf('search_1')?.isActive).toBe(true);
  });

  it('changes nothing when the search ended before it took its lock', async () => {
    const search = await searchAt('search_1', aSet(10));
    const ended = search.stationLeft(NOW);

    enabled.set(STATION.stationId, false);
    memory.searchRepository.locked = async () => ended;

    await turningOff().lineChanged(STATION.lineId);

    expect(stateOf('search_1')?.stopReason).toBeNull();
  });
});
