import { ReadStationImprovementHandler } from '@replays/application/queries/handlers/read-station-improvement.handler';
import { ReadStationImprovementQuery } from '@replays/application/queries/read-station-improvement.query';
import {
  accessFor,
  FakeSuppliers,
  InMemoryConfigPullRequests,
  InMemoryReplays,
  PERSON,
  STATION_VIEW,
} from '@replays/application/services/replays.fake-spec';
import { SetHealths } from '@replays/application/services/set-healths.service';
import { StationSearchSchedule } from '@replays/domain/aggregates/station-search-schedule.aggregate';
import {
  aSearch,
  aSet,
  candidateOf,
  NOW,
  replayFor,
  STATION,
} from '@replays/domain/replays.fake-spec';
import { CandidateScoring } from '@replays/domain/value-objects/candidate-scoring.vo';
import { SearchPolicy } from '@replays/domain/value-objects/search-policy.vo';
import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { beforeEach, describe, expect, it } from 'vitest';

const DAY = 24 * 60 * 60 * 1000;

const daysAfter = (days: number) => new Date(NOW.getTime() + days * DAY);

let memory: InMemoryReplays;
let suppliers: FakeSuppliers;

const read = (stationId = STATION.stationId.value) =>
  new ReadStationImprovementHandler(
    accessFor(memory, suppliers, false),
    memory.setRepository,
    memory.scheduleRepository,
    memory.searchRepository,
    memory.replayRepository,
    memory.candidateRepository,
    new InMemoryConfigPullRequests(),
    suppliers.configs,
    new SetHealths(
      suppliers.configs,
      memory.replayRepository,
      memory.candidateRepository,
    ),
    suppliers.trialableRuns,
    { now: () => NOW, sleep: async () => {} },
  ).execute(
    new ReadStationImprovementQuery(
      STATION.teamId.value,
      STATION.lineId.value,
      stationId,
      PERSON,
    ),
  );

const searchingEvery = (days: number, enabled = true) =>
  SearchPolicy.of({
    enabled,
    monthlyCeiling: 50,
    currency: 'USD',
    ceiling: 10,
    periodMilliseconds: days * DAY,
    onAlert: true,
    cooldownMilliseconds: 3 * DAY,
    agent: null,
    iterations: null,
    repeats: null,
    objective: null,
    requestsPerDay: 3,
  });

const searching = (policy: SearchPolicy) => {
  const settings = suppliers.lines.stationSettings;

  suppliers.lines.stationSettings = async () => {
    const found = await settings();

    return found && { ...found, search: policy };
  };
};

beforeEach(() => {
  memory = new InMemoryReplays();
  suppliers = new FakeSuppliers();
});

describe('ReadStationImprovementHandler', () => {
  it('says the set is too small to search, why the last search was skipped, and when Spotlight looks again', async () => {
    const set = aSet(3);

    await memory.setRepository.add(set);
    await memory.scheduleRepository.add(
      StationSearchSchedule.create({
        station: STATION,
        setId: set.id,
        at: NOW,
      }).skipped('set-too-small', NOW, daysAfter(1)),
    );
    searching(searchingEvery(7));

    const answer = await read();

    expect(answer.set).toMatchObject({
      tasks: 3,
      fewestTasks: 5,
      bigEnough: false,
      fresh: null,
    });
    expect(answer.lastSkip).toEqual({
      reason: 'set-too-small',
      at: NOW.toISOString(),
      text: 'The replay set has too few tasks. A search needs at least 5. Spotlight adds the station’s new runs to the set.',
      retryAt: daysAfter(1).toISOString(),
    });
    expect(answer.lastSearch).toBeNull();
    expect(answer.nextSearchAt).toBeNull();
  });

  it('says when the next search is due once nothing stands in its way', async () => {
    const set = aSet(6);

    await memory.setRepository.add(set);
    await memory.scheduleRepository.add(
      StationSearchSchedule.create({
        station: STATION,
        setId: set.id,
        at: daysAfter(2),
      }),
    );
    searching(searchingEvery(7));

    const answer = await read();

    expect(answer.set?.fresh).toEqual({
      tasks: 6,
      heldOutTasks: 2,
      enough: true,
    });
    expect(answer.nextSearchAt).toBe(daysAfter(2).toISOString());
    expect(answer.lastSkip).toBeNull();
  });

  it('shows no skip while search is off for the station', async () => {
    const set = aSet(3);

    await memory.setRepository.add(set);
    await memory.scheduleRepository.add(
      StationSearchSchedule.create({
        station: STATION,
        setId: set.id,
        at: NOW,
      }).skipped('set-too-small', NOW, daysAfter(1)),
    );
    searching(searchingEvery(7, false));

    expect(await read()).toMatchObject({ lastSkip: null, nextSearchAt: null });
  });

  it('says whether a replay can score the station', async () => {
    expect((await read()).scoring).toEqual({
      judge: false,
      check: false,
      scores: false,
    });

    suppliers.candidates.live = async () => ({
      lineKey: 'delivery',
      fingerprint: candidateOf('live').fingerprint,
      scoring: CandidateScoring.of({
        checksChanges: true,
        judge: null,
        rubricVersion: null,
      }),
      hashes: candidateOf('live').hashes,
    });

    expect((await read()).scoring).toEqual({
      judge: false,
      check: true,
      scores: true,
    });
  });

  it('has no set, search or next search for a station Spotlight has not replayed', async () => {
    expect(await read()).toMatchObject({
      set: null,
      lastSearch: null,
      nextSearchAt: null,
      lastSkip: null,
    });
  });

  it('shows the running search with the runs of its replays', async () => {
    const set = aSet(6);

    await memory.setRepository.add(set);
    await memory.searchRepository.add(aSearch({ set }));
    await memory.candidateRepository.add(candidateOf('live'));
    await memory.replayRepository.add(
      replayFor(set, 'replay_seed', 'candidate_live', null, true),
    );

    const search = (await read()).lastSearch;

    expect(search).toMatchObject({
      searchId: 'search_1',
      state: 'seeding',
      trigger: 'schedule',
      result: null,
    });
    expect(search?.replays).toHaveLength(1);
    expect(search?.replays[0]).toMatchObject({
      replayId: 'replay_seed',
      live: true,
      state: 'queued',
    });
    expect(search?.replays[0]?.candidate).toMatch(/^Live config/);
    expect(search?.replays[0]?.runs).toHaveLength(6);
    expect(search?.replays[0]?.runs[0]).toEqual({
      runId: null,
      originalRunId: 'original_0',
      taskId: 'task_0',
      taskTitle: null,
      progress: 'waiting',
      succeeded: null,
    });
  });

  it('says why a stopped search stopped', async () => {
    const set = aSet(6);

    await memory.setRepository.add(set);
    await memory.searchRepository.add(aSearch({ set }).turnOff(NOW));

    expect((await read()).lastSearch).toMatchObject({
      state: 'stopped',
      result: 'A person turned off search for the station.',
    });
  });

  it('shows nothing of a station on another team', async () => {
    suppliers.lines.station = async (lineId, stationId) =>
      stationId.value === 'station_theirs'
        ? {
            ...STATION_VIEW,
            teamId: TeamId.of('team_2'),
            stationId,
            lineId,
          }
        : null;

    await expect(read('station_theirs')).rejects.toThrow(ApplicationError);
  });
});
