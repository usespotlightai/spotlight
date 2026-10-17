import type { ReplayDto } from '@replays/application/dto/replays.dto';
import { ListReplaysHandler } from '@replays/application/queries/handlers/list-replays.handler';
import { ListReplaysQuery } from '@replays/application/queries/list-replays.query';
import { made } from '@replays/application/services/replayed-candidates.fake-spec';
import {
  accessFor,
  FakeWork,
  InMemoryReplays,
  PERSON,
} from '@replays/application/services/replays.fake-spec';
import { SetHealths } from '@replays/application/services/set-healths.service';
import { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import { Replay } from '@replays/domain/aggregates/replay.aggregate';
import {
  aReplay,
  aSet,
  BY,
  CONCLUDING_CHECKS,
  candidateOf,
  endOf,
  FINGERPRINT,
  LIVE_FINGERPRINT,
  later,
  measuresOf,
  NOW,
  replayedAs,
  runIds,
  SEARCH_ID,
  STATION,
} from '@replays/domain/replays.fake-spec';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { Hypothesis } from '@replays/domain/value-objects/hypothesis.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { Spend } from '@replays/domain/value-objects/spend.vo';
import { StationChanges } from '@replays/domain/value-objects/station-changes.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const live = candidateOf('live');

const terse = Candidate.fromSearch({
  ...made,
  id: CandidateId.of('candidate_terse'),
  name: 'terse',
  changedFrom: StationChanges.of(LIVE_FINGERPRINT, [
    { part: 'prompt', name: null, kind: 'changed', was: null, now: null },
  ]),
  search: {
    searchId: SEARCH_ID,
    iteration: 1,
    hypothesis: Hypothesis.of('Being terse keeps it on task.'),
  },
});

const succeeded = () => 'completed' as const;

const failed = () => 'failed' as const;

const aBaseline = (id: string, at: number) =>
  aReplay({ id, candidate: live, baseline: true, at: later(at) });

const firstSucceeded = (original: string) =>
  original === 'original_0' ? 'completed' : 'failed';

const scoredOn = (replay: Replay, tasks: number): Replay => {
  const reserved = replay.reserving(replay.entries.length, runIds());

  return reserved.entries.slice(0, tasks).reduce((held, entry) => {
    const run = entry.run as RunId;

    return held
      .confirm(run, FINGERPRINT, NOW)
      .recordRunEnd(run, endOf('completed'))
      .recordReview(run, CONCLUDING_CHECKS, null, later(60_000))
      .measure(run, measuresOf(1), later(61_000));
  }, reserved);
};

const withTheAnswer = (against: Replay): Replay => {
  const set = aSet(3);
  const replay = Replay.start({
    id: ReplayId.of('replay_answer'),
    set,
    candidate: Candidate.oracleOf(live, {
      id: CandidateId.of('candidate_answer'),
      at: NOW,
    }),
    baseline: false,
    ceiling: Spend.ceiling(10, 'USD'),
    at: later(3),
    by: BY,
    oracle: {
      answers: set.runs.map((run) => ({ run, answer: 'accepted' as const })),
      against,
      live,
    },
  });

  replay.pullEvents();

  return replay;
};

const listed = async (
  replays: readonly Replay[],
): Promise<readonly ReplayDto[]> => {
  const memory = new InMemoryReplays();
  const work = new FakeWork();

  await memory.setRepository.add(aSet(3));
  for (const each of replays) {
    await memory.replayRepository.add(each);
  }
  for (const each of [live, candidateOf('proposed'), terse]) {
    await memory.candidateRepository.add(each);
  }

  return new ListReplaysHandler(
    accessFor(memory, work),
    memory.replayRepository,
    memory.candidateRepository,
    new SetHealths(work, memory.replayRepository, memory.candidateRepository),
  ).execute(new ListReplaysQuery(STATION.teamId.value, 'set_1', PERSON));
};

const listedAs = (replays: readonly ReplayDto[], id: string): ReplayDto => {
  const found = replays.find((each) => each.id === id);

  if (!found) {
    throw new Error(`no replay ${id} listed`);
  }

  return found;
};

describe('ListReplaysHandler', () => {
  it('names the replay each gain is against, with that replay’s success rate', async () => {
    const old = replayedAs(aBaseline('replay_old', 0), succeeded);
    const fresh = replayedAs(aBaseline('replay_fresh', 1), failed);
    const paired = replayedAs(
      aReplay({ id: 'replay_paired', pairsWith: 'replay_old', at: later(2) }),
      succeeded,
    );
    const answer = replayedAs(withTheAnswer(old), succeeded);
    const proposed = replayedAs(
      aReplay({ id: 'replay_proposed', at: later(4) }),
      succeeded,
    );

    const replays = await listed([old, fresh, paired, answer, proposed]);
    const oldRate = { replayId: 'replay_old', successRate: 1 };
    const freshRate = { replayId: 'replay_fresh', successRate: 0 };

    expect(listedAs(replays, 'replay_paired').comparedWith).toMatchObject(
      oldRate,
    );
    expect(listedAs(replays, 'replay_answer').comparedWith).toMatchObject(
      oldRate,
    );
    expect(listedAs(replays, 'replay_proposed').comparedWith).toMatchObject(
      freshRate,
    );
    expect(listedAs(replays, 'replay_old').comparedWith).toMatchObject(
      freshRate,
    );
    expect(listedAs(replays, 'replay_fresh').comparedWith).toBeNull();
    for (const each of replays) {
      expect(each.againstBaseline === null).toBe(each.comparedWith === null);
    }
  });

  it('compares a searched candidate with its search’s seed', async () => {
    const seed = replayedAs(
      aReplay({
        id: 'replay_seed',
        candidate: live,
        searchId: SEARCH_ID,
        at: later(1),
      }),
      firstSucceeded,
    );
    const searched = replayedAs(
      aReplay({
        id: 'replay_terse',
        candidate: terse,
        searchId: SEARCH_ID,
        pairsWith: 'replay_seed',
        at: later(2),
      }),
      succeeded,
    );
    const baseline = replayedAs(aBaseline('replay_fresh', 0), succeeded);

    const replays = await listed([baseline, seed, searched]);

    expect(listedAs(replays, 'replay_terse').comparedWith).toMatchObject({
      replayId: 'replay_seed',
      successRate: 1 / 3,
    });
  });

  it('compares a replay with the answer with nothing once its live replay is gone', async () => {
    const gone = replayedAs(aBaseline('replay_gone', 0), succeeded);
    const answer = replayedAs(withTheAnswer(gone), succeeded);
    const fresh = replayedAs(aBaseline('replay_fresh', 1), failed);

    const shown = listedAs(await listed([fresh, answer]), 'replay_answer');

    expect(shown.comparedWith).toBeNull();
    expect(shown.againstBaseline).toBeNull();
  });

  it('shows no rate for a counterpart that has scored nothing yet', async () => {
    const running = aBaseline('replay_running', 1);
    const proposed = replayedAs(
      aReplay({ id: 'replay_proposed', at: later(4) }),
      succeeded,
    );

    const shown = listedAs(
      await listed([running, proposed]),
      'replay_proposed',
    );

    expect(shown.comparedWith).toEqual({
      replayId: 'replay_running',
      successRate: null,
      interval: null,
    });
    expect(shown.againstBaseline).toBeNull();
  });

  it('rates the counterpart on the tasks the gain pairs, with their interval', async () => {
    const fresh = replayedAs(aBaseline('replay_fresh', 1), firstSucceeded);
    const proposed = scoredOn(
      aReplay({ id: 'replay_proposed', at: later(4) }),
      2,
    );

    const replays = await listed([fresh, proposed]);
    const shown = listedAs(replays, 'replay_proposed');

    expect(listedAs(replays, 'replay_fresh').totals.successRate).toBe(1 / 3);
    expect(shown.againstBaseline?.tasks).toBe(2);
    expect(shown.comparedWith).toMatchObject({
      replayId: 'replay_fresh',
      successRate: 0.5,
      interval: { rate: 0.5 },
    });
  });
});
