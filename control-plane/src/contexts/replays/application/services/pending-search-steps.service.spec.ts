import {
  FakeWork,
  InMemoryReplays,
  stepsFor,
} from '@replays/application/services/replays.fake-spec';
import { LineSearchBudget } from '@replays/domain/aggregates/line-search-budget.aggregate';
import {
  PENDING_STEP_LEASE_MS,
  StationSearchSchedule,
} from '@replays/domain/aggregates/station-search-schedule.aggregate';
import {
  aSearch,
  candidateOf,
  NOW,
  SEARCH_ID,
  STATION,
} from '@replays/domain/replays.fake-spec';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { Money } from '@replays/domain/value-objects/money.vo';
import { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import { SearchPolicy } from '@replays/domain/value-objects/search-policy.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { beforeEach, describe, expect, it } from 'vitest';

const DAY = 24 * 60 * 60 * 1000;
const ABANDONED = SearchId.of('search_abandoned');

let memory: InMemoryReplays;
let now: Date;

const clock: ClockPort = { now: () => now, sleep: async () => {} };

const schedule = (): StationSearchSchedule => {
  const found = memory.schedules.get(STATION.stationId.value);

  if (!found) {
    throw new Error('the station has no search schedule');
  }

  return found;
};

const POLICY = SearchPolicy.of({
  enabled: true,
  monthlyCeiling: 50,
  currency: 'USD',
  ceiling: 10,
  periodMilliseconds: 7 * DAY,
  onAlert: true,
  cooldownMilliseconds: 3 * DAY,
  agent: null,
  iterations: 2,
  repeats: null,
  objective: null,
});

const startedAt = (searchId: SearchId, at: Date) =>
  schedule().started({
    searchId,
    request: null,
    candidates: [CandidateId.of(`live_of_${searchId.value}`)],
    searched: [TaskId.of('task_a')],
    inSet: [TaskId.of('task_a')],
    at,
    cooldownMilliseconds: 3 * DAY,
  });

beforeEach(async () => {
  memory = new InMemoryReplays();
  now = NOW;
  await memory.scheduleRepository.add(
    StationSearchSchedule.create({
      station: STATION,
      setId: ReplaySetId.of('set_1'),
      at: NOW,
    }),
  );
});

describe('PendingSearchSteps', () => {
  it('undoes a search start whose search never came, once its lease ends: candidates, schedule and admission', async () => {
    await memory.candidateRepository.add(
      candidateOf('live', `live_of_${ABANDONED.value}`),
    );
    await memory.scheduleRepository.save(startedAt(ABANDONED, NOW));
    await memory.budgetRepository.add(
      LineSearchBudget.open({
        lineId: STATION.lineId,
        workspaceId: STATION.workspaceId,
        teamId: STATION.teamId,
        at: NOW,
      }).admit(
        {
          searchId: ABANDONED,
          ceiling: Money.of(10, 'USD'),
          admittedAt: NOW,
        },
        POLICY,
        [],
      ),
    );

    now = new Date(NOW.getTime() + PENDING_STEP_LEASE_MS - 1);
    await stepsFor(memory, new FakeWork(), clock).processDue();

    expect(schedule().pendingSteps).toHaveLength(1);

    now = new Date(NOW.getTime() + PENDING_STEP_LEASE_MS);
    await stepsFor(memory, new FakeWork(), clock).processDue();

    expect(schedule()).toMatchObject({
      pendingSteps: [],
      lastStartedAt: null,
      searchedTasks: [],
      stepsPendingSince: null,
    });
    expect(memory.candidates.size).toBe(0);
    expect([...memory.budgets.values()][0]?.admits(ABANDONED)).toBe(false);
  });

  it('confirms a search start whose search exists', async () => {
    await memory.searchRepository.add(aSearch());
    await memory.scheduleRepository.save(startedAt(SEARCH_ID, NOW));

    now = new Date(NOW.getTime() + PENDING_STEP_LEASE_MS);
    await stepsFor(memory, new FakeWork(), clock).processDue();

    expect(schedule().pendingSteps).toEqual([]);
    expect(schedule().lastStartedAt).toEqual(NOW);
  });

  it('confirms a join the search holds, and withdraws the request of one it does not', async () => {
    await memory.searchRepository.add(aSearch({ requestedBy: 'user_1' }));
    await memory.candidateRepository.add(candidateOf('searched', 'lost'));
    await memory.scheduleRepository.save(
      schedule()
        .requested({
          searchId: SEARCH_ID,
          request: CandidateId.of('candidate_asked'),
          at: NOW,
        })
        .requested({
          searchId: SEARCH_ID,
          request: CandidateId.of('lost'),
          at: NOW,
        }),
    );

    now = new Date(NOW.getTime() + PENDING_STEP_LEASE_MS);
    await stepsFor(memory, new FakeWork(), clock).processDue();

    expect(schedule().pendingSteps).toEqual([]);
    expect(schedule().requests?.counted).toEqual([
      CandidateId.of('candidate_asked'),
    ]);
    expect(memory.candidates.has('lost')).toBe(false);
  });
});
