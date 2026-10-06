import {
  MOST_REPLAYED,
  ReadReplayedCandidatesHandler,
} from '@replays/application/queries/handlers/read-replayed-candidates.handler';
import { ReadReplayedCandidatesQuery } from '@replays/application/queries/read-replayed-candidates.query';
import {
  made,
  replayedWorld,
  replayOf,
} from '@replays/application/services/replayed-candidates.fake-spec';
import {
  accessFor,
  FakeWork,
  InMemoryConfigPullRequests,
  InMemoryReplays,
  PERSON,
} from '@replays/application/services/replays.fake-spec';
import { SetHealths } from '@replays/application/services/set-healths.service';
import { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import { ConfigPullRequest } from '@replays/domain/aggregates/config-pull-request.aggregate';
import { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import {
  aSet,
  BY,
  candidateOf,
  LIVE_FINGERPRINT,
  NOW,
  SEARCH_ID,
  STATION,
} from '@replays/domain/replays.fake-spec';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { ConfigPullRequestId } from '@replays/domain/value-objects/config-pull-request-id.vo';
import { PlannedReference } from '@replays/domain/value-objects/planned-reference.vo';
import { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import { ReplaySetName } from '@replays/domain/value-objects/replay-set-name.vo';
import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import { StationChanges } from '@replays/domain/value-objects/station-changes.vo';
import { UseCaseFault } from '@shared-kernel/application/errors/use-case.fault';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { beforeEach, describe, expect, it } from 'vitest';

const DAY_MS = 24 * 60 * 60 * 1000;

const daysAfter = (days: number): Date =>
  new Date(NOW.getTime() + days * DAY_MS);

let memory: InMemoryReplays;
let now: Date;
let pullRequests: InMemoryConfigPullRequests;

const read = (period = '30d', mayPlan: boolean | null = false) => {
  const work = new FakeWork();

  return new ReadReplayedCandidatesHandler(
    accessFor(memory, work, mayPlan),
    memory.replayRepository,
    memory.searchRepository,
    memory.setRepository,
    memory.candidateRepository,
    pullRequests,
    work,
    { now: () => now, sleep: async () => {} },
    new SetHealths(work, memory.replayRepository, memory.candidateRepository),
  ).execute(
    new ReadReplayedCandidatesQuery(STATION.teamId.value, PERSON, period),
  );
};

const namesIn = async (period = '30d') =>
  (await read(period)).stations
    .flatMap((station) => station.sets)
    .flatMap((set) => set.candidates.map((each) => each.name))
    .sort();

beforeEach(async () => {
  memory = new InMemoryReplays();
  pullRequests = new InMemoryConfigPullRequests();
  now = NOW;
  const world = replayedWorld();

  await memory.setRepository.add(world.set);
  await memory.searchRepository.add(world.search);
  for (const each of world.candidates) {
    await memory.candidateRepository.add(each);
  }
  for (const each of world.replays) {
    await memory.replayRepository.add(each);
  }
});

describe('ReadReplayedCandidatesHandler', () => {
  it('shows a team reader the searched and proposed candidates of the period', async () => {
    const answer = await read();

    expect(answer.period).toEqual({
      name: '30d',
      from: '2026-09-02T00:00:00.000Z',
      to: '2026-10-02T00:00:00.000Z',
    });
    expect(answer.truncated).toBe(false);
    expect(answer.stations).toHaveLength(1);
    expect(await namesIn()).toEqual(['Shorter prompt', 'terse', 'wordy']);
  });

  it('shows a candidate only when its replay, or its search, started in the period', async () => {
    now = daysAfter(40);
    const set = (await memory.setRepository.find(
      ReplaySetId.of('set_1'),
    )) as ReplaySet;
    const lately = candidateOf('proposed', 'candidate_lately');

    await memory.candidateRepository.add(lately);
    await memory.replayRepository.add(
      replayOf(set, 'replay_lately', lately, daysAfter(39)),
    );

    expect(await namesIn('30d')).toEqual(['Shorter prompt']);
    expect(await namesIn('90d')).toEqual([
      'Shorter prompt',
      'Shorter prompt',
      'terse',
      'wordy',
    ]);
    expect((await read('30d')).stations[0]?.sets[0]?.baseline?.replayId).toBe(
      'replay_seed',
    );
  });

  it('leaves out candidates a pull-request check replayed', async () => {
    const planned = Candidate.planned({
      ...made,
      id: CandidateId.of('candidate_planned'),
      changedFrom: StationChanges.none(LIVE_FINGERPRINT),
      reference: PlannedReference.of({ pullRequest: 3 }),
      line: null,
    });

    await memory.candidateRepository.add(planned);
    await memory.replayRepository.add(
      replayOf(aSet(10), 'replay_planned', planned, NOW),
    );

    expect(await namesIn()).toEqual(['Shorter prompt', 'terse', 'wordy']);
  });

  it('shows nothing of another team', async () => {
    const other = { ...STATION, teamId: TeamId.of('team_2') };
    const set = ReplaySet.opened({
      id: ReplaySetId.of('set_other'),
      station: other,
      name: ReplaySetName.of('Theirs'),
      at: NOW,
    }).withEntry(
      {
        runId: RunId.of('original_theirs'),
        taskId: TaskId.of('task_theirs'),
        stationId: other.stationId,
        refusal: null,
        reason: null,
      },
      NOW,
      false,
    );
    const theirs = Candidate.proposed({
      ...made,
      station: other,
      id: CandidateId.of('candidate_theirs'),
      name: candidateOf('proposed').name,
      changedFrom: StationChanges.none(LIVE_FINGERPRINT),
      by: BY,
    });

    await memory.setRepository.add(set);
    await memory.candidateRepository.add(theirs);
    await memory.replayRepository.add(
      replayOf(set, 'replay_theirs', theirs, NOW),
    );

    expect((await read()).stations.map((each) => each.sets.length)).toEqual([
      1,
    ]);
    expect((await read()).stations[0]?.sets.map((each) => each.setId)).toEqual([
      'set_1',
    ]);
    await expect(read('30d', null)).rejects.toThrow(UseCaseFault);
  });

  it('covers the newest replays of the period, saying when it left older ones out, yet keeps the searches its sets started in it', async () => {
    const set = (await memory.setRepository.find(
      ReplaySetId.of('set_1'),
    )) as ReplaySet;
    const proposed = candidateOf('proposed');

    for (let each = 0; each < MOST_REPLAYED; each += 1) {
      await memory.replayRepository.add(
        replayOf(
          set,
          `replay_again_${each}`,
          proposed,
          new Date(NOW.getTime() + 10 + each),
        ),
      );
    }

    const answer = await read();

    expect(answer.truncated).toBe(true);
    expect(await namesIn()).toEqual(['Shorter prompt', 'terse', 'wordy']);
    expect(
      answer.stations[0]?.sets[0]?.candidates.find(
        (each) => each.kind === 'proposed',
      )?.replayId,
    ).toBe(`replay_again_${MOST_REPLAYED - 1}`);
  });

  it('links each searched candidate to the pull request picking it opened, and no other search’s', async () => {
    const pick = (id: string, searchId: string) =>
      ConfigPullRequest.picked({
        id: ConfigPullRequestId.of(id),
        searchId: SearchId.of(searchId),
        candidateId: CandidateId.of('candidate_terse'),
        station: STATION,
        stationKey: 'build',
        candidateName: 'terse',
        lineKey: 'delivery',
        source: null,
        at: NOW,
        by: BY,
      });

    await pullRequests.add(pick('pr_terse', SEARCH_ID.value));
    await pullRequests.add(pick('pr_elsewhere', 'search_other'));

    const candidates = (await read()).stations[0]?.sets[0]?.candidates ?? [];

    expect(
      candidates.find((each) => each.name === 'terse')?.pullRequest?.id,
    ).toBe('pr_terse');
    expect(
      candidates.find((each) => each.name === 'wordy')?.pullRequest,
    ).toBeNull();
  });

  it('refuses a period it does not take', async () => {
    await expect(read('14d')).rejects.toThrow(UseCaseFault);
  });
});
